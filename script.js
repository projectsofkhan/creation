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
const eOut = k => 1 - Math.pow(1 - k, 3);
const $   = i => document.getElementById(i);
const rd  = () => { const u = rnd(-1, 1), a = rnd(0, 2*PI), s = Math.sqrt(1-u*u); return new V(s*Math.cos(a), u, s*Math.sin(a)); };
const alerp = (a, b, t) => { let d = ((b - a + PI) % (2*PI)) - PI; if (d < -PI) d += 2*PI; return a + d * t; };

/* ============================================================
   AUDIO
   ============================================================ */
const AUDIO_URLS = {
  explode:  './audio/explode.mp3',
  purple:   './audio/purple.mp3',
  nuke:     './audio/nuke.mp3',
  domain:   './audio/sukuna-domain.mp3',
  slash:    './audio/blackslash.mp3',
  roar:     './audio/bleach-dragon-roar.mp3',
  wind:     './audio/bleach-wind.mp3',
  clash:    './audio/bleach-sword-clash.mp3'
};
const AUDIO = {}; const AUDIO_OK = {};
let audioLoaded = 0, audioTotal = Object.keys(AUDIO_URLS).length;

function preloadAudio() {
  return new Promise(resolve => {
    const ld = $('ld');
    let resolved = false;
    const finish = () => { if (!resolved) { resolved = true; resolve(); } };
    for (const [key, url] of Object.entries(AUDIO_URLS)) {
      const a = new Audio(); a.preload = 'auto'; a.src = url;
      a.volume = key === 'wind' ? .35 : 1.0;
      AUDIO[key] = a; AUDIO_OK[key] = false;
      let settled = false;
      const done = (ok) => { if (settled) return; settled = true; AUDIO_OK[key] = ok; audioLoaded++; if (ld) ld.textContent = `Loading… ${audioLoaded}/${audioTotal}`; if (audioLoaded === audioTotal) finish(); };
      a.addEventListener('canplaythrough', () => done(true), { once: true });
      a.addEventListener('error', () => done(false), { once: true });
      setTimeout(() => { if (!settled) done(false); }, 6000);
    }
    setTimeout(finish, 7000);
  });
}
function playSound(name, volScale = 1) {
  const a = AUDIO[name];
  if (!a || !AUDIO_OK[name]) return;
  try {
    const c = a.cloneNode();
    c.volume = Math.min(1, (name === 'wind' ? .35 : 1.0) * volScale);
    const p = c.play(); if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}

let AC = null, masterGain = null, noiseBuf = null;
async function initSynthAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') await AC.resume();
    masterGain = AC.createGain(); masterGain.gain.value = .45; masterGain.connect(AC.destination);
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
    g.gain.linearRampToValueAtTime(vol, t + dur * .2);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(masterGain); s.start(t); s.stop(t + dur + .05);
  } catch (e) {}
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!AC || AC.state !== 'running') return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    const t = AC.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + .05);
  } catch (e) {}
}
function sfxClash() { noise('highpass', 5000, 1500, .12, .4); tone('triangle', 2800, 900, .08, .3); }
function sfxImpact(power = 1) { tone('sine', 110, 30, .35, .4 * power); noise('lowpass', 2000, 200, .12, .35 * power, 1.5); }
function sfxRumble() { noise('lowpass', 200, 40, 4, .5); tone('sine', 45, 25, 4, .5); }
function sfxSlash() { noise('highpass', 8000, 2000, .15, .35); tone('sawtooth', 400, 100, .12, .2); }
function sfxWhoosh() { noise('bandpass', 600, 3000, .22, .35, 1.5); }

/* ============================================================
   RENDERER / POST
   ============================================================ */
const stage = $('stage');
let W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
stage.insertBefore(renderer.domElement, stage.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 2, .1, 1200);

let composer = null, caPass = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.4, .85, .3));
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
        col *= mix(.55,1.,vig);
        col += .02 * sin(vUv.y*900. + time*40.) * amount * 8.;
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
  r.addColorStop(0, '#fff'); r.addColorStop(.4, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

/* ============================================================
   LIGHTING
   ============================================================ */
scene.add(new THREE.AmbientLight(0x443355, 1.4));
const hemi = new THREE.HemisphereLight(0xaa6666, 0x110008, 1.6);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 15, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xaa3060, 2.2);
rimLight.position.set(-8, 8, -10);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xff8040, 1.5);
fillLight.position.set(10, 4, -6);
scene.add(fillLight);
const combatLight = new THREE.PointLight(0xffffff, 0, 120, 2);
scene.add(combatLight);
let combatLightI = 0;

/* ============================================================
   SKY
   ============================================================ */
const skyGeo = new THREE.SphereGeometry(500, 32, 20);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { t: { value: 0 }, hue: { value: 0 }, flash: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `
    uniform float t, hue, flash; varying vec3 vP;
    void main(){
      vec3 dir = normalize(vP);
      float y = dir.y * .5 + .5;
      vec3 top = mix(vec3(.02,.01,.04), vec3(.15,.02,.03), hue);
      vec3 bot = mix(vec3(.25,.05,.08), vec3(.5,.05,.05), hue);
      vec3 col = mix(bot, top, y);
      col += sin(dir.x*10.+t)*sin(dir.z*10.+t*1.3)*.03;
      col += flash * vec3(.4,.1,.1);
      gl_FragColor = vec4(col,1.);
    }`
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

/* Clouds */
const clouds = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.PlaneGeometry(rnd(80, 160), rnd(40, 80));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1a0404, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(rnd(-120, 120), rnd(35, 70), rnd(-140, -60));
  m.rotation.x = -PI * .2;
  scene.add(m); clouds.push(m);
}

/* ============================================================
   RUINED PALACE
   ============================================================ */
const palace = new THREE.Group();
scene.add(palace);
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, roughness: .85 });
const stoneDark = new THREE.MeshStandardMaterial({ color: 0x0f0505, roughness: .9 });
const stoneLight = new THREE.MeshStandardMaterial({ color: 0x4a3838, roughness: .8 });

const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(120, 64), stoneMat);
floorMesh.rotation.x = -PI / 2; floorMesh.position.y = -0.02;
palace.add(floorMesh);

for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(8 + i * 5, 9 + i * 5, 32, 1), stoneDark);
  ring.rotation.x = -PI / 2; ring.position.y = .01 + i * .01;
  palace.add(ring);
}

for (let i = 0; i < 24; i++) {
  const a = rnd(0, PI * 2), r = rnd(15, 60);
  const h = rnd(4, 14);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(rnd(.4, .7), rnd(.6, 1), h, 8), Math.random() < .5 ? stoneLight : stoneDark);
  pillar.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
  if (Math.random() < .6) { pillar.rotation.z = rnd(-.6, .6); pillar.rotation.x = rnd(-.5, .5); pillar.position.y = Math.max(h * .3, 1); }
  palace.add(pillar);
}

for (let i = 0; i < 8; i++) {
  const a = (i / 8) * PI * 2 + rnd(-.3, .3);
  const r = rnd(35, 55);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(rnd(6, 14), rnd(4, 12), rnd(.6, 1.2)), stoneDark);
  wall.position.set(Math.cos(a) * r, rnd(1, 6), Math.sin(a) * r);
  wall.rotation.y = -a + rnd(-.3, .3); wall.rotation.z = rnd(-.2, .2);
  palace.add(wall);
}

const debris = [];
for (let i = 0; i < 25; i++) {
  const size = rnd(.6, 2.8);
  const block = new THREE.Mesh(new THREE.BoxGeometry(size, size * rnd(.5, 1.2), size), Math.random() < .5 ? stoneLight : stoneDark);
  block.position.set(rnd(-45, 45), rnd(6, 40), rnd(-45, 45));
  block.rotation.set(rnd(0, PI), rnd(0, PI), rnd(0, PI));
  palace.add(block);
  debris.push({ mesh: block, baseY: block.position.y, sp: rnd(.2, .8), rotSp: rnd(.2, .8) });
}

/* Embers */
const emberGeo = new THREE.BufferGeometry();
const emberCount = 600;
const emberPos = new Float32Array(emberCount * 3);
const emberVel = new Float32Array(emberCount * 3);
for (let i = 0; i < emberCount; i++) {
  emberPos[i*3] = rnd(-70, 70); emberPos[i*3+1] = rnd(0, 35); emberPos[i*3+2] = rnd(-70, 70);
  emberVel[i*3] = rnd(-.3, .3); emberVel[i*3+1] = rnd(.4, 1.4); emberVel[i*3+2] = rnd(-.3, .3);
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff5520, size: .18, map: glowTex, blending: AD, transparent: true, depthWrite: false }));
scene.add(embers);

/* ============================================================
   AIZEN & YHWACH
   ============================================================ */
function makeChar(opts) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? .55, metalness: o.m ?? .1, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 0, side: o.side ?? THREE.FrontSide });
  const skinM = M(opts.skin, {r: .5}), topM = M(opts.top, {r: .5}), pantsM = M(opts.pants, {r: .65}), hairM = M(opts.hair, {r: .35}), bootM = M(opts.boots, {r: .4});
  const eyeM = new THREE.MeshBasicMaterial({ color: opts.eye });
  const grp = (p,x,y,z)=>{const q=new THREE.Group();q.position.set(x,y,z);p.add(q);return q;};

  const hips = grp(g, 0, 1.05, 0);
  const torso = grp(hips, 0, .05, 0);
  torso.add(new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .32, 10), topM)).position.y = .16;
  torso.add(new THREE.Mesh(new THREE.CylinderGeometry(.30, .22, .35, 10), topM)).position.y = .48;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.34, .08, .04), topM);
  chest.position.set(0, .56, .19); torso.add(chest);

  if (opts.style === 'aizen') {
    for (const s of [1, -1]) {
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(.32, .95, 1, 4), M(opts.top, {r: .5, side: THREE.DoubleSide}));
      tail.position.set(s * .15, -.42, .02); tail.rotation.x = .18; torso.add(tail);
    }
    const haori = new THREE.Mesh(new THREE.CylinderGeometry(.36, .34, 1.1, 12, 1, true), M(0xf5f0e8, {r: .55, side: THREE.DoubleSide}));
    haori.position.y = -.05; torso.add(haori);
  } else {
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(.42, .55, 1.3, 14, 1, true), M(0x0a0202, {r: .7, side: THREE.DoubleSide}));
    cape.position.y = -.15; torso.add(cape);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(.35, .28, .35, 12, 1, true), M(0x0a0202, {r: .7, side: THREE.DoubleSide}));
    collar.position.y = .72; torso.add(collar);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .14, 8), skinM);
  neck.position.y = .68; torso.add(neck);

  const head = grp(torso, 0, .92, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.17, 24, 18), skinM);
  skull.position.y = .1; skull.scale.set(.95, 1.08, .95); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10, 0, PI*2, PI*.55, PI*.45), skinM);
  jaw.position.y = .04; head.add(jaw);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.18, 24, 18, 0, PI*2, 0, PI*.6), hairM);
  hairCap.position.y = .1; head.add(hairCap);

  if (opts.style === 'aizen') {
    for (let i = 0; i < 7; i++) {
      const a = -PI*.5 + (i / 6) * PI;
      const s = new THREE.Mesh(new THREE.ConeGeometry(.05, .22, 5), hairM);
      s.position.set(Math.cos(a) * .12, .18, Math.sin(a) * .08 - .06);
      s.rotation.x = -.4; s.rotation.z = -Math.cos(a) * .3;
      head.add(s);
    }
    const frame = new THREE.Mesh(new THREE.TorusGeometry(.12, .007, 4, 16), M(0x222222, {r: .2, m: .8}));
    frame.position.set(0, .14, .155); frame.rotation.x = PI / 2; frame.scale.set(1, .55, 1);
    head.add(frame);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -PI * .4 + (i / 9) * PI * .8;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(.035, .02, .45, 5), hairM);
      s.position.set(Math.cos(a) * .13, .06, Math.sin(a) * .1 - .08);
      s.rotation.x = .8; s.rotation.z = -Math.cos(a) * .2;
      head.add(s);
    }
  }

  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 12, 10), eyeM);
    eye.position.set(s * .065, .13, .155); head.add(eye);
    eyes.push(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.08, .012, .01), new THREE.MeshBasicMaterial({ color: 0x301010 }));
  mouth.position.set(0, .04, .16); head.add(mouth);

  const arm = s => {
    const sh = grp(torso, s * .37, .68, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), topM));
    sh.add(new THREE.Mesh(new THREE.CapsuleGeometry(.075, .24, 4, 8), topM)).position.y = -.19;
    const el = grp(sh, 0, -.36, 0);
    el.add(new THREE.Mesh(new THREE.CapsuleGeometry(.065, .26, 4, 8), skinM)).position.y = -.19;
    const hand = grp(el, 0, -.38, 0);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), skinM);
    fist.scale.set(1, .85, 1.15); hand.add(fist);
    return { sh, el, hand };
  };
  const armL = arm(1), armR = arm(-1);

  const leg = s => {
    const hp = grp(hips, s * .14, 0, 0);
    hp.add(new THREE.Mesh(new THREE.CapsuleGeometry(.1, .36, 4, 8), pantsM)).position.y = -.25;
    const kn = grp(hp, 0, -.5, 0);
    kn.add(new THREE.Mesh(new THREE.CapsuleGeometry(.085, .34, 4, 8), pantsM)).position.y = -.24;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.16, .18, .36), bootM);
    boot.position.set(0, -.44, .06); kn.add(boot);
    return { hp, kn };
  };
  const legL = leg(1), legR = leg(-1);

  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.5, .015), new THREE.MeshStandardMaterial({ color: 0xdde5f0, metalness: .95, roughness: .15, emissive: 0x223344, emissiveIntensity: .4 }));
  blade.position.y = -.75; sword.add(blade);
  sword.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .28, 8), M(0x1a0a0a))).position.y = .12;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .025, 12), M(0x8a7030, {m: .9, r: .2}));
  guard.position.y = .02; sword.add(guard);
  armR.hand.add(sword);
  sword.position.y = -.05; sword.rotation.x = PI / 2;

  return {
    g, hips, torso, head, armL, armR, legL, legR, sword, L: armL, R: armR, lL: legL, lR: legR, p: g.position,
    cur: {}, vel: {}, tgt: {}, ret: 0, yaw: 0, yawTgt: 0, pv: new V(), spd: 0,
    hd: 0, tilt: 0, eyes, breathe: Math.random() * PI * 2
  };
}

const POSE = {
  idle:      { hy:0,   tx:0,   ty:0,  hdx:0,  lsx:-.15, lsz:.15, lel:-.4, rsx:-.15, rsz:-.15, rel:-.4, lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  standTall: { hy:0,   tx:-.05,ty:0,  hdx:0,  lsx:-.1,  lsz:.3,  lel:-.5, rsx:-.1,  rsz:-.3,  rel:-.5, lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  swordReady:{ hy:-.1, tx:.2,  ty:.3, hdx:0,  lsx:-.6,  lsz:.2,  lel:-.5, rsx:-.9,  rsz:-.3,  rel:-.2, lhx:-.3, lkn:.5,  rhx:.3,  rkn:.3  },
  slash:     { hy:-.15,tx:.4,  ty:-.5,hdx:0,  lsx:-.3,  lsz:.15, lel:-.5, rsx:-1.6, rsz:-.4,  rel:0,   lhx:-.7, lkn:.8,  rhx:.4,  rkn:.1  },
  slashDown: { hy:-.2, tx:.5,  ty:-.3,hdx:.1, lsx:-.2,  lsz:.15, lel:-.4, rsx:-2.4, rsz:-.3,  rel:0,   lhx:-.9, lkn:.9,  rhx:.5,  rkn:.1  },
  slashUp:   { hy:.1,  tx:-.2, ty:.3, hdx:-.1,lsx:-.5,  lsz:.2,  lel:-.5, rsx:-2.7, rsz:-.4,  rel:-.3, lhx:-.4, lkn:.4,  rhx:.3,  rkn:.2  },
  block:     { hy:-.1, tx:-.15,ty:.3, hdx:0,  lsx:-1.3, lsz:.3,  lel:-.8, rsx:-1.4, rsz:-.35, rel:-.3, lhx:-.3, lkn:.4,  rhx:.3,  rkn:.3  },
  blockHigh: { hy:-.05,tx:-.3, ty:.2, hdx:.1, lsx:-1.8, lsz:.3,  lel:-1,  rsx:-1.8, rsz:-.4,  rel:-.5, lhx:-.3, lkn:.4,  rhx:.3,  rkn:.4  },
  raiseOne:  { hy:0,   tx:-.1, ty:0,  hdx:-.1,lsx:-.2,  lsz:.2,  lel:-.4, rsx:-2.8, rsz:-.6,  rel:-.3, lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  raiseBoth: { hy:0,   tx:-.15,ty:0,  hdx:-.15,lsx:-2.9,lsz:.5,  lel:-.3, rsx:-2.9, rsz:-.5,  rel:-.3, lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  point:     { hy:-.05,tx:.1,  ty:-.3,hdx:0,  lsx:.2,   lsz:.1,  lel:-.3, rsx:-1.7, rsz:-.15, rel:0,   lhx:-.3, lkn:.4,  rhx:0,   rkn:.1  },
  land:      { hy:-.4, tx:.2,  ty:0,  hdx:0,  lsx:-.4,  lsz:.3,  lel:-.4, rsx:-.4,  rsz:-.3,  rel:-.4, lhx:-1,  lkn:1.4, rhx:-1, lkn2:1.4,rkn:1.4},
  cutDown:   { hy:-.4, tx:.5,  ty:0,  hdx:.2, lsx:-.3,  lsz:.15, lel:-.3, rsx:-1.5, rsz:-.3,  rel:-.1, lhx:-1.2,lkn:1.5, rhx:.5,  rkn:1.5 }
};
const KEYS = ['hy','tx','ty','hdx','lsx','lsz','lel','rsx','rsz','rel','lhx','lkn','rhx','rkn'];

function setPose(c, name, hold = false) { c.tgt = POSE[name]; c.ret = hold ? 0 : .25; }

function updateFighter(f, pos, other, dt, time, moving = false) {
  f.p.set(pos.x, pos.y, pos.z);
  f.yawTgt = Math.atan2(other.p.x - f.p.x, other.p.z - f.p.z);
  f.yaw = alerp(f.yaw, f.yawTgt, 1 - Math.exp(-12 * dt));
  f.g.rotation.y = f.yaw;
  const speed = f.pv.distanceTo(f.p) / Math.max(dt, .001);
  f.spd = cl(speed / 12, 0, 1);
  f.pv.copy(f.p);
  if (moving) f.hd += dt * (8 + f.spd * 10);

  const c = f.cur, v = f.vel;
  const stiffness = 260, damping = 26;
  for (const k of KEYS) {
    const target = f.tgt[k] || 0;
    const acc = (target - c[k]) * stiffness - v[k] * damping;
    v[k] += acc * dt; c[k] += v[k] * dt;
  }
  c.lkn = cl(c.lkn, 0, 2.5); c.rkn = cl(c.rkn, 0, 2.5);
  c.lel = cl(c.lel, -2.5, 0); c.rel = cl(c.rel, -2.5, 0);

  f.breathe += dt * 1.5;
  const breath = Math.sin(f.breathe) * .008 * (1 - f.spd);
  const sw = moving ? Math.sin(f.hd) * .6 * f.spd : 0;
  f.hips.position.y = 1.05 + c.hy + breath - f.spd * .05;
  f.torso.rotation.set(c.tx, c.ty, 0);
  f.head.rotation.x = c.hdx;
  f.L.sh.rotation.set(c.lsx, 0, c.lsz); f.L.el.rotation.x = c.lel;
  f.R.sh.rotation.set(c.rsx, 0, c.rsz); f.R.el.rotation.x = c.rel;
  f.lL.hp.rotation.x = c.lhx + sw; f.lL.kn.rotation.x = c.lkn + Math.max(0, -sw) * 1.1;
  f.lR.hp.rotation.x = c.rhx - sw; f.lR.kn.rotation.x = c.rkn + Math.max(0, sw) * 1.1;
}
function resetChar(f) { f.cur = { ...POSE.idle }; f.tgt = POSE.idle; f.vel = {}; for (const k of KEYS) { if (f.cur[k] === undefined) f.cur[k] = 0; f.vel[k] = 0; } }

const aizen = makeChar({ skin: 0xf2e0d0, top: 0x0a0a0e, pants: 0x0a0a0e, hair: 0x2a1408, boots: 0x0a0505, eye: 0x8a2020, style: 'aizen' });
resetChar(aizen); aizen.g.position.set(0, 0, 40); aizen.g.visible = false;

const yhwach = makeChar({ skin: 0xd8c8b8, top: 0x0a0202, pants: 0x0a0202, hair: 0x0a0202, boots: 0x080202, eye: 0x8a0000, style: 'yhwach' });
resetChar(yhwach); yhwach.g.position.set(0, 0, -12); yhwach.g.visible = false;

/* ============================================================
   DRAGONS
   ============================================================ */
const dragons = [];
function makeDragon(idx) {
  const dragonGroup = new THREE.Group();
  const segments = 20;
  const segMeshes = [];
  for (let i = 0; i < segments; i++) {
    const s = 1 - i / segments;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(.4 * s + .15, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().lerpColors(new THREE.Color(0x4a0a0a), new THREE.Color(0xff3010), 1 - i / segments), transparent: true, opacity: .9, blending: AD, depthWrite: false }));
    dragonGroup.add(seg); segMeshes.push(seg);
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(.55, 1.4, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4020, blending: AD, transparent: true, opacity: .98, depthWrite: false }));
  head.rotation.x = PI / 2; head.position.z = -.4; dragonGroup.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
    eye.position.set(s * .22, .12, -.7); dragonGroup.add(eye);
  }
  scene.add(dragonGroup); dragonGroup.visible = false;
  return { group: dragonGroup, segs: segMeshes, head, phase: idx * (PI * 2 / 5), radius: 14 + idx * .8, height: 10 + idx * .5, visible: false };
}
for (let i = 0; i < 5; i++) dragons.push(makeDragon(i));

function updateDragons(dt, time) {
  for (let i = 0; i < dragons.length; i++) {
    const d = dragons[i];
    if (!d.visible) continue;
    const phase = d.phase + time * 1.8;
    const bx = Math.cos(phase) * d.radius, bz = Math.sin(phase) * d.radius, by = d.height + Math.sin(time * 2 + i) * 2;
    d.group.position.set(bx, by, bz);
    d.group.rotation.y = -phase + PI / 2;
    for (let s = 0; s < d.segs.length; s++) {
      const t = s / d.segs.length;
      const tp = phase - t * 2.2;
      const tx = Math.cos(tp) * d.radius, tz = Math.sin(tp) * d.radius;
      const ty = d.height + Math.sin(time * 2 + i + t * 3) * 2 - t * 2;
      d.segs[s].position.set(tx - bx, ty - by, tz - bz);
      d.segs[s].scale.setScalar(1 - t * .55);
    }
  }
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
    scene.add(new THREE.Points(g, this.m));
    this.m.uniforms.sc.value = 600;
    this.points = new THREE.Points(g, this.m);
    this.points.frustumCulled = false;
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
const spark = (p, n, spd, sz, t, c, g = 6) => {
  for (let i = 0; i < n; i++) {
    const v = rd().multiplyScalar(spd * rnd(.25, 1));
    glowParticles.e(p.x, p.y, p.z, v.x, v.y, v.z, sz * rnd(.5, 1.3), t * rnd(.6, 1.3), c[0], c[1], c[2], g, 1.4);
  }
};

/* ============================================================
   FX
   ============================================================ */
const fxList = [];
const ringGeo = new THREE.RingGeometry(.9, 1, 48);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
let shake = 0, hitStop = 0;
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
  const e = $('sub');
  e.innerHTML = `<b>${name}</b><em>"${text}"</em>`;
  e.style.opacity = 1;
  clearTimeout(subTimer); subTimer = setTimeout(() => e.style.opacity = 0, d * 1000);
}
function lightFlash(p, c, i) { combatLight.position.copy(p); combatLight.color.set(c); combatLightI = i; }
function impact(p, pw, c = [1.4, .5, .3]) {
  spark(p, Math.floor(30 * pw), 15 * pw, .5, .6, c, 8);
  sphereFX(p, 0xffdd88, 2 * pw, .3);
  ringFX(p, 0xffffff, 4 * pw, .35, true);
  lightFlash(p, 0xff8040, 400 * pw);
  shake = Math.max(shake, .8 * pw);
  if (caPass) caPass.uniforms.amount.value = Math.max(caPass.uniforms.amount.value, .012 + pw * .004);
  sfxImpact(pw);
}
function freeze(t) { hitStop = Math.max(hitStop, t); }

/* ============================================================
   CAMERA SHOTS
   ============================================================ */
const CAMERA_SHOTS = [];
const addShot = (a, b, fn) => CAMERA_SHOTS.push([a, b, fn]);
function setCam(px, py, pz, lx, ly, lz, fov = 50) {
  cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(lx, ly, lz);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
}

/* ============================================================
   TIMELINE
   ============================================================ */
const EVENTS = [];
const at = (t, fn) => EVENTS.push([t, fn]);
const aizenPos = new V(0, 0, 25);
const yhwachPos = new V(0, 0, -12);

/* ---- 0.0–3.0: BLACK + WIND + DRIP ---- */
at(0, () => {
  flashScreen('#000', 1, 1.5);
  playSound('wind', 1);
  noise('lowpass', 300, 100, 5, .3, .6);
});
at(1.5, () => {
  tone('sine', 2000, 1200, .1, .3);
  noise('lowpass', 200, 40, 4, .4);
});
addShot(0, 3, k => setCam(0, 40, 90, 0, 5, 0, 45));

/* ---- 3.0–8.0: AERIAL OF RUINED PALACE ---- */
at(3, () => {
  yhwach.g.visible = true;
  yhwach.g.position.copy(yhwachPos);
  yhwach.g.position.y = 1.35;
  setPose(yhwach, 'standTall', true);
  showBanner('BLEACH', 'THE FINAL DECEPTION', 3.5);
});
addShot(3, 8, k => {
  setCam(lerp(8, 3, es(k)), lerp(35, 4, es(k)), lerp(65, 18, es(k)), 0, 2, -10, lerp(50, 40, k));
});

/* ---- 8.0–12.0: SPIKE + SILHOUETTE WALK ---- */
at(8, () => {
  aizen.g.visible = true;
  aizen.g.position.set(0, 0, 55);
  setPose(aizen, 'swordReady', true);
  noise('lowpass', 150, 60, 4, .4);
});
for (let i = 0; i < 5; i++) {
  setTimeout(() => { tone('sine', 500, 250, .08, .25); sfxWhoosh(); }, 1500 + i * 500);
}
addShot(8, 12, k => {
  setCam(lerp(0, 3, k), 2, lerp(58, 30, k), 0, 1.6, 20, 40);
});

/* AIZEN LINE 1 */
at(10, () => say('AIZEN', 'How disappointing.', 2));

/* ---- 12.0–18.0: FAST CLOSE-IN + FIRST STRIKE ---- */
at(12, () => {
  aizen.g.position.set(0, 0, 8);
  yhwach.g.position.set(0, 0, -2);
  setPose(aizen, 'swordReady');
  setPose(yhwach, 'standTall');
});
addShot(12, 15, k => {
  const a = k * PI * .8;
  setCam(Math.sin(a) * 6, 2.5, 8 + Math.cos(a) * 4, 0, 1.8, 3, 45);
});

/* rapid strike volley */
const strikes = [
  { t: 13.0, atk: aizen, def: yhwach, pos: 'slash' },
  { t: 13.4, atk: yhwach, def: aizen, pos: 'slashDown' },
  { t: 13.8, atk: aizen, def: yhwach, pos: 'slashUp' },
  { t: 14.2, atk: yhwach, def: aizen, pos: 'slash' },
  { t: 14.6, atk: aizen, def: yhwach, pos: 'slashDown' },
  { t: 15.0, atk: yhwach, def: aizen, pos: 'slashUp' },
  { t: 15.4, atk: aizen, def: yhwach, pos: 'slash' },
  { t: 15.8, atk: yhwach, def: aizen, pos: 'slashDown' }
];
for (const s of strikes) {
  at(s.t, () => {
    setPose(s.atk, s.pos);
    setPose(s.def, 'block');
    const p = s.def.head.getWorldPosition(new V());
    impact(p.clone().add(new V(0, -.3, 0)), 2);
    sfxClash(); playSound('clash', .8);
    flashScreen('#fff', .35, .2);
    freeze(.04);
    shake = Math.max(shake, 4);
  });
}

/* camera cuts fast */
for (let i = 0; i < 8; i++) {
  const t0 = 13 + i * .4;
  addShot(t0, t0 + .4, k => {
    const a = i * 1.2;
    setCam(
      Math.sin(a) * 5 + (i % 2 ? 2 : -2),
      2 + Math.sin(a) * 1.5,
      Math.cos(a) * 5,
      0, 1.8, 3, 40 + i * 2
    );
  });
}

/* ---- 18.0–25.0: JUMP BACK + ALMIGHTY ---- */
at(18, () => {
  setPose(aizen, 'idle');
  setPose(yhwach, 'raiseOne');
  aizen.g.position.set(-3, 0, 5);
  yhwach.g.position.set(3, 0, 0);
  yhwach.eyes.forEach(e => e.material.color.setHex(0xff2020));
  showBanner('THE ALMIGHTY', '', 2);
  flashScreen('#600', .5, 1);
  noise('lowpass', 120, 40, 3, .5);
  tone('sine', 55, 30, 3, .5);
  shake = 8;
});
addShot(18, 22, k => {
  const hp = yhwach.head.getWorldPosition(new V());
  setCam(hp.x, hp.y, hp.z + 1.5, hp.x, hp.y, hp.z, lerp(45, 28, k));
});
addShot(22, 25, k => setCam(3, 2, 6, 0, 1.8, 2, 45));

/* ---- 25.0–34.0: BLACK ENERGY CHARGES ---- */
at(25, () => {
  setPose(yhwach, 'raiseBoth');
  showBanner('GORYŪTENMETSU', '', 2.5);
  playSound('roar', 1);
  noise('lowpass', 200, 40, 3, .6);
  tone('sawtooth', 80, 40, 3, .4);
  skyMat.uniforms.hue.value = 1;
  flashScreen('#400', .6, 1.5);
  shake = 10;
  for (const d of dragons) { d.visible = true; d.group.visible = true; }
});
addShot(25, 34, k => {
  const a = k * PI * 1.5;
  setCam(Math.sin(a) * 30, 15 + Math.sin(k * PI * 2) * 4, Math.cos(a) * 30, 0, 10, 0, lerp(55, 45, k));
});

/* ---- 34.0–40.0: CONVERGENCE → EXPLOSION ---- */
at(34, () => {
  setPose(yhwach, 'slash');
  playSound('roar', 1);
  flashScreen('#f40', .8, .6);
  shake = 15;
});
addShot(34, 38, k => setCam(aizen.g.position.x + 5, 3, 20, aizen.g.position.x, 2, aizen.g.position.z, 55));

at(37, () => {
  flashScreen('#fff', 1, 1.5);
  playSound('nuke');
  noise('lowpass', 1500, 30, 2.5, .9);
  tone('sine', 90, 20, 2.2, 1);
  shake = 25;
  freeze(.4);
  for (const d of dragons) {
    spark(d.group.position, 80, 30, 1, 1.8, [1.5, .4, .1], 3);
    d.visible = false; d.group.visible = false;
  }
  for (let i = 0; i < 10; i++) {
    const p = aizen.g.position.clone().add(new V(rnd(-10, 10), rnd(1, 5), rnd(-5, 5)));
    sphereFX(p, 0xff5020, 18, 1.8);
    ringFX(p, 0xff6020, 30, 1.4, true);
  }
  if (caPass) caPass.uniforms.amount.value = .07;
});

/* ---- 40.0–46.0: AIZEN LINE 2 ---- */
at(40, () => {
  aizen.g.position.set(3, 0, 2);
  setPose(aizen, 'standTall', true);
  yhwach.g.position.set(-3, 0, -5);
  setPose(yhwach, 'idle');
  say('AIZEN', 'You should have remained imprisoned.', 2.5);
});
addShot(40, 46, k => {
  const yp = yhwach.head.getWorldPosition(new V());
  setCam(yp.x + 2.5, yp.y + 1, yp.z + 3, aizen.g.position.x, 1.8, aizen.g.position.z, 42);
});

/* ---- 46.0–54.0: FAST SWORD EXCHANGE II ---- */
const strikes2 = [
  { t: 46.5, atk: aizen, def: yhwach, pos: 'slash' },
  { t: 47.0, atk: yhwach, def: aizen, pos: 'slashDown' },
  { t: 47.5, atk: aizen, def: yhwach, pos: 'slashUp' },
  { t: 48.0, atk: yhwach, def: aizen, pos: 'slash' },
  { t: 48.5, atk: aizen, def: yhwach, pos: 'slashDown' },
  { t: 49.0, atk: yhwach, def: aizen, pos: 'slashUp' },
  { t: 49.5, atk: aizen, def: yhwach, pos: 'slash' },
  { t: 50.0, atk: yhwach, def: aizen, pos: 'slashDown' },
  { t: 50.5, atk: aizen, def: yhwach, pos: 'slashUp' },
  { t: 51.0, atk: yhwach, def: aizen, pos: 'slash' },
  { t: 51.5, atk: aizen, def: yhwach, pos: 'slashDown' },
  { t: 52.0, atk: yhwach, def: aizen, pos: 'slashUp' }
];
for (const s of strikes2) {
  at(s.t, () => {
    setPose(s.atk, s.pos);
    setPose(s.def, Math.random() < .5 ? 'block' : 'blockHigh');
    const p = s.def.head.getWorldPosition(new V());
    impact(p.clone().add(new V(rnd(-.3, .3), -.3, 0)), 2.2);
    sfxClash(); playSound('clash', .9);
    flashScreen('#fff', .4, .2);
    freeze(.03);
    shake = Math.max(shake, 5);
  });
}
for (let i = 0; i < 12; i++) {
  const t0 = 46.5 + i * .5;
  addShot(t0, t0 + .5, k => {
    const a = i * .9;
    const r = 4 + (i % 3) * 1.5;
    setCam(
      Math.sin(a) * r + (i % 2 ? 1.5 : -1.5),
      2 + (i % 2) * .8,
      Math.cos(a) * r + 2,
      0, 1.8, 0, 38 + (i % 4) * 3
    );
  });
}

/* ---- 54.0–58.0: AIZEN PUSHED BACK ---- */
at(54, () => {
  setPose(aizen, 'block');
  setPose(yhwach, 'slashDown');
  aizen.g.position.set(-2, 0, 5);
  yhwach.g.position.set(4, 0, 0);
  const p = aizen.head.getWorldPosition(new V());
  impact(p, 4);
  sfxSlash(); playSound('slash', 1);
  flashScreen('#fff', .8, .6);
  freeze(.2);
  shake = 15;
  if (caPass) caPass.uniforms.amount.value = .05;
});
addShot(54, 58, k => {
  const a = k * PI * 2;
  setCam(Math.sin(a) * 6, 2.5 + Math.sin(k * PI) * 2, Math.cos(a) * 6, -2, 2, 4, 42);
});

/* ---- 58.0–66.0: AIRBORNE → LAND ---- */
at(58, () => {
  setPose(aizen, 'slashDown');
  // launch Aizen up
  aizen.g.position.set(0, 5, 3);
});
addShot(58, 66, k => {
  setCam(lerp(4, 2, es(k)), lerp(3, 8, es(k)), lerp(10, 6, k), 0, aizen.g.position.y, 3, 45);
});

/* ---- 66.0–74.0: FINAL STRIKE LOCK ---- */
at(66, () => {
  yhwach.g.position.set(aizen.g.position.x + .5, aizen.g.position.y, aizen.g.position.z - 1.5);
  setPose(yhwach, 'slash');
  setPose(aizen, 'block');
  const p = aizen.head.getWorldPosition(new V());
  impact(p, 5);
  playSound('clash', 1);
  sfxClash(); sfxImpact(1.5);
  flashScreen('#fff', 1, .7);
  freeze(.3);
  shake = 20;
  if (caPass) caPass.uniforms.amount.value = .08;
});
addShot(66, 74, k => {
  const cx = (aizen.g.position.x + yhwach.g.position.x) / 2;
  const cy = aizen.g.position.y + 1.5;
  const cz = (aizen.g.position.z + yhwach.g.position.z) / 2;
  const a = k * PI * 2.2;
  setCam(cx + Math.sin(a) * 5, cy + 1.2, cz + Math.cos(a) * 5, cx, cy, cz, 40);
});

/* ---- 74.0–88.0: DRAGON SPECTACLE II — 5 DRAGONS SURROUND ---- */
at(74, () => {
  setPose(aizen, 'land');
  setPose(yhwach, 'raiseBoth');
  aizen.g.position.set(0, 0, 5);
  yhwach.g.position.set(0, 3, -8);
  showBanner('GORYŪTENMETSU', '', 2);
  playSound('roar', 1);
  noise('lowpass', 150, 30, 3, .6);
  tone('sawtooth', 70, 30, 3, .5);
  skyMat.uniforms.hue.value = 1;
  flashScreen('#400', .6, 1);
  shake = 12;
  for (const d of dragons) { d.visible = true; d.group.visible = true; d.radius = 10 + Math.random() * 4; d.height = 6 + Math.random() * 6; }
});
addShot(74, 82, k => {
  const a = k * PI * 2;
  setCam(Math.sin(a) * 20, 12, Math.cos(a) * 20, 0, 8, 0, 55);
});
addShot(82, 88, k => {
  const p = aizen.head.getWorldPosition(new V());
  setCam(p.x + 3, p.y + 2, p.z + 4, p.x, p.y, p.z, 42);
});

/* ---- 88.0–98.0: FULL CONVERGENCE → EXPLOSION II ---- */
at(88, () => {
  setPose(yhwach, 'slashDown');
  playSound('nuke');
  noise('lowpass', 2000, 25, 3, 1);
  tone('sine', 100, 18, 2.5, 1.2);
  tone('triangle', 55, 22, 2.8, .9);
  flashScreen('#fff', 1, 2);
  shake = 30;
  freeze(.5);
  for (const d of dragons) { spark(d.group.position, 100, 35, 1.2, 2, [1.5, .4, .1], 3); d.visible = false; d.group.visible = false; }
  for (let i = 0; i < 15; i++) {
    const p = aizen.g.position.clone().add(rd().multiplyScalar(rnd(3, 18)));
    sphereFX(p, 0xff5020, 22, 2);
    ringFX(p, 0xff6020, 40, 1.8, true);
  }
  spark(aizen.g.position.clone().setY(2), 400, 30, 1, 2.5, [1.5, .5, .2], -1);
  if (caPass) caPass.uniforms.amount.value = .1;
});
addShot(88, 94, k => {
  setCam(lerp(4, 8, k), lerp(3, 5, k), lerp(12, 18, k), 0, 2, 0, 50);
});
addShot(94, 98, k => {
  // smoking aftermath — slow camera push
  setCam(lerp(6, 3, k), 2, lerp(14, 8, k), 0, 1.8, 3, 42);
});

/* ---- 98.0–108.0: DUST CLEARS, AIZEN STANDING ---- */
at(98, () => {
  // hide dust
  aizen.g.position.set(0, 0, 3);
  setPose(aizen, 'standTall', true);
});
addShot(98, 108, k => setCam(lerp(2, 4, k), 1.8, lerp(6, 8, k), 0, 1.8, 3, 40));

/* ---- 108.0–120.0: FINAL SWORD CLASH SPECTACLE ---- */
at(108, () => {
  yhwach.g.position.set(0, 0, 0);
  aizen.g.position.set(0, 0, 4);
  setPose(aizen, 'swordReady');
  setPose(yhwach, 'slashDown');
  const p = aizen.head.getWorldPosition(new V());
  impact(p, 3);
  playSound('clash', 1);
  sfxClash();
  flashScreen('#fff', .7, .5);
  freeze(.15);
  shake = 15;
});
addShot(108, 120, k => {
  const a = k * PI * 3;
  setCam(Math.sin(a) * 4, 2, 2 + Math.cos(a) * 4, 0, 1.8, 2, 42);
});

/* ---- 120.0–132.0: MAJOR FINAL SWING ---- */
at(120, () => {
  setPose(aizen, 'slashUp');
  setPose(yhwach, 'slashDown');
  aizen.g.position.set(-2, 0, 4);
  yhwach.g.position.set(2, 0, 0);
  const p = new V(0, 2, 2);
  impact(p, 5);
  playSound('explode', 1);
  flashScreen('#fff', 1, .8);
  freeze(.3);
  shake = 22;
  if (caPass) caPass.uniforms.amount.value = .06;
  sphereFX(p, 0xffffff, 8, .8);
  sphereFX(p, 0xffa040, 15, 1.2);
  ringFX(p, 0xffffff, 25, 1);
});
addShot(120, 126, k => {
  const p = new V(0, 2, 2);
  setCam(p.x + Math.sin(k * PI) * 8, 3 + k * 2, p.z + Math.cos(k * PI) * 8, p.x, p.y, p.z, 50);
});
addShot(126, 132, k => setCam(lerp(6, 3, es(k)), 2, lerp(12, 8, k), 0, 1.8, 2, 45));

/* ---- 132.0–140.0: AIZEN LINE 3 (FINAL) ---- */
at(132, () => {
  setPose(aizen, 'standTall', true);
  setPose(yhwach, 'idle');
  aizen.g.position.set(0, 0, 4);
  yhwach.g.position.set(0, 0, -3);
  say('AIZEN', 'How interesting.', 3);
});
addShot(132, 140, k => {
  const ap = aizen.head.getWorldPosition(new V());
  setCam(ap.x + 2, ap.y + .3, ap.z + 2.5, ap.x, ap.y, ap.z, lerp(42, 32, k));
});

/* ---- 140.0–148.0: ALMIGHTY FINAL FLARE ---- */
at(140, () => {
  yhwach.eyes.forEach(e => e.material.color.setHex(0xff0000));
  showBanner('THE ALMIGHTY', '', 2);
  flashScreen('#600', .6, 1);
  noise('lowpass', 150, 40, 4, .6);
  tone('sine', 60, 25, 4, .6);
  shake = 10;
});
addShot(140, 148, k => {
  const yp = yhwach.head.getWorldPosition(new V());
  setCam(yp.x, yp.y, yp.z + 2, yp.x, yp.y, yp.z, lerp(45, 25, k));
});

/* ---- 148.0–155.0: FINAL SILENCE + CUT ---- */
at(148, () => {
  setPose(aizen, 'standTall');
  setPose(yhwach, 'standTall');
});
addShot(148, 155, k => setCam(lerp(4, 6, k), 2.5, lerp(10, 14, k), 0, 2, 0, lerp(45, 50, k)));

at(152, () => flashScreen('#000', 1, 2));
at(155, () => playSound('wind', 1));

/* ---- 155.0–180.0: END SCREEN ---- */
at(158, () => {
  const en = $('en'); en.style.display = 'flex';
  requestAnimationFrame(() => en.style.opacity = 1);
});
at(180, () => {});

/* ============================================================
   MAIN LOOP
   ============================================================ */
let T = 0, running = false, eventIdx = 0, last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(.05, (now - last) / 1000);
  last = now;
  let dt = rawDt;
  if (hitStop > 0) { hitStop -= rawDt; dt = 0; }
  if (running && dt > 0) T += dt;
  while (running && eventIdx < EVENTS.length && EVENTS[eventIdx][0] <= T) { EVENTS[eventIdx][1](); eventIdx++; }

  if (aizen.g.visible) updateFighter(aizen, aizen.g.position, yhwach, dt, T, false);
  if (yhwach.g.visible) updateFighter(yhwach, yhwach.g.position, aizen, dt, T, false);

  updateDragons(rawDt, T);

  /* embers */
  const ep = emberGeo.attributes.position.array;
  for (let i = 0; i < emberCount; i++) {
    ep[i*3+1] += emberVel[i*3+1] * dt;
    ep[i*3] += emberVel[i*3] * dt;
    ep[i*3+2] += emberVel[i*3+2] * dt;
    if (ep[i*3+1] > 35) { ep[i*3+1] = 0; ep[i*3] = rnd(-70, 70); ep[i*3+2] = rnd(-70, 70); }
  }
  emberGeo.attributes.position.needsUpdate = true;

  /* debris */
  for (const d of debris) {
    d.mesh.position.y = d.baseY + Math.sin(T * d.sp) * 1.2;
    d.mesh.rotation.x += d.rotSp * rawDt * .3;
    d.mesh.rotation.y += d.rotSp * rawDt * .4;
  }
  for (const c of clouds) { c.position.x += dt * .3; if (c.position.x > 130) c.position.x = -130; }

  /* camera */
  let camUpdated = false;
  for (const s of CAMERA_SHOTS) {
    if (T >= s[0] && T < s[1]) { s[2]((T - s[0]) / (s[1] - s[0])); camUpdated = true; break; }
  }
  if (!camUpdated && T > 155) setCam(0, 2, 8, 0, 2, 0, 45);

  if (shake > .01) {
    const q = cam.quaternion.clone();
    cam.position.x += rnd(-1, 1) * shake * .15;
    cam.position.y += rnd(-1, 1) * shake * .15;
    cam.position.z += rnd(-1, 1) * shake * .15;
    cam.quaternion.copy(q);
    shake *= Math.exp(-8 * rawDt);
  }
  cam.updateProjectionMatrix();

  if (caPass) { caPass.uniforms.amount.value *= Math.exp(-6 * rawDt); caPass.uniforms.time.value += rawDt; }
  combatLightI *= Math.exp(-10 * rawDt);
  combatLight.intensity = combatLightI;
  skyMat.uniforms.t.value += rawDt * .2;

  for (let i = fxList.length - 1; i >= 0; i--) if (!fxList[i](rawDt)) fxList.splice(i, 1);
  glowParticles.u(rawDt);
  const sc = renderer.domElement.height / (2 * Math.tan(cam.fov * PI / 360));
  glowParticles.m.uniforms.sc.value = sc;

  if (composer) composer.render();
  else renderer.render(scene, cam);
}

$('go').addEventListener('click', async () => {
  const btn = $('go'); btn.disabled = true; btn.textContent = 'Loading…';
  await preloadAudio();
  await initSynthAudio();
  const ok = Object.values(AUDIO_OK).filter(Boolean).length;
  console.log(`[audio] ${ok}/${audioTotal} loaded`);
  $('st').style.display = 'none';
  try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}
  setTimeout(() => {
    layout(); T = 0; eventIdx = 0; running = true;
    shake = 0; combatLightI = 0; hitStop = 0;
    aizen.g.position.set(0, 0, 55); aizen.g.visible = false;
    yhwach.g.position.set(0, 0, -12); yhwach.g.visible = false;
    resetChar(aizen); resetChar(yhwach);
    for (const d of dragons) { d.visible = false; d.group.visible = false; }
    skyMat.uniforms.hue.value = 0;
    for (let i = 0; i < glowParticles.max; i++) { glowParticles.l[i] = 0; glowParticles.s[i] = 0; }
  }, 350);
});

$('re').addEventListener('click', () => location.reload());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(frame);