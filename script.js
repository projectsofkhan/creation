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
   AUDIO — MP3s + synthesized orchestral
   ============================================================ */
const AUDIO_URLS = {
  explode:    './audio/explode.mp3',
  purple:     './audio/purple.mp3',
  nuke:       './audio/nuke.mp3',
  domain:     './audio/sukuna-domain.mp3',
  laugh:      './audio/sukuna-laugh.mp3',
  slash:      './audio/blackslash.mp3',
  youcan:     './audio/youcan.mp3',
  wind:       './audio/bleach-wind.mp3',
  choir:      './audio/bleach-choir.mp3',
  roar:       './audio/bleach-dragon-roar.mp3',
  clash:      './audio/bleach-sword-clash.mp3'
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
      a.volume = key === 'wind' ? .35 : key === 'choir' ? .4 : 1.0;
      AUDIO[key] = a;
      AUDIO_OK[key] = false;

      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        AUDIO_OK[key] = ok;
        audioLoaded++;
        if (ld) ld.textContent = `Loading audio… ${audioLoaded}/${audioTotal}`;
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
    const base = name === 'wind' ? .35 : name === 'choir' ? .4 : 1.0;
    clone.volume = Math.min(1, base * volScale);
    const p = clone.play();
    if (p && p.catch) p.catch(() => {});
    clone.addEventListener('ended', () => { try { clone.src = ''; } catch(e){} }, { once: true });
  } catch (e) {}
}

/* Synth — orchestral bed, percussion, impacts */
let AC = null, masterGain = null, noiseBuf = null;
async function initSynthAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') await AC.resume();
    masterGain = AC.createGain(); masterGain.gain.value = .4; masterGain.connect(AC.destination);
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
function synthWind()   { noise('lowpass', 400, 180, 6, .25, .8); }
function synthChoir()  { tone('sine', 110, 105, 8, .12); tone('sine', 165, 155, 8, .08, .2); tone('sine', 220, 210, 8, .06, .4); }
function synthRumble() { noise('lowpass', 120, 40, 3, .5, .5); tone('sine', 55, 30, 3, .4); }
function synthDragon() { tone('sawtooth', 80, 40, 2, .4); noise('lowpass', 800, 60, 2.2, .5, .6); }
function synthClash()  { noise('highpass', 4000, 1200, .15, .35); tone('triangle', 2400, 800, .1, .25); }
function synthDeep()   { tone('sine', 40, 25, 3, .6); noise('lowpass', 300, 60, 3, .35); }
function synthImpact() { tone('sine', 90, 30, .4, .35); noise('bandpass', 1500, 400, .1, .3, 2); }

/* ============================================================
   STAGE / RENDERER / POST
   ============================================================ */
const stage = $('stage');
let W = innerWidth, H = innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
stage.insertBefore(renderer.domElement, stage.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 2, .1, 1200);

let composer = null, caPass = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 1.3, .8, .3));
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
  r.addColorStop(0, '#fff'); r.addColorStop(.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const fireTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,220,120,1)');
  r.addColorStop(.3, 'rgba(255,80,40,.85)');
  r.addColorStop(.6, 'rgba(120,10,20,.4)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

/* ============================================================
   LIGHTING
   ============================================================ */
scene.add(new THREE.AmbientLight(0x443355, 1.4));
const hemi = new THREE.HemisphereLight(0xaa6666, 0x110008, 1.6);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(5, 15, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xaa3060, 2.0);
rimLight.position.set(-8, 8, -10);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xff8040, 1.4);
fillLight.position.set(10, 4, -6);
scene.add(fillLight);
const combatLight = new THREE.PointLight(0xffffff, 0, 120, 2);
scene.add(combatLight);
let combatLightI = 0;

/* ============================================================
   SKY / ATMOSPHERE
   ============================================================ */
const skyGeo = new THREE.SphereGeometry(500, 32, 20);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { t: { value: 0 }, hue: { value: 0 } },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    uniform float t, hue; varying vec3 vP;
    void main(){
      vec3 dir = normalize(vP);
      float y = dir.y * .5 + .5;
      vec3 top = mix(vec3(.02,.01,.04), vec3(.15,.02,.03), hue);
      vec3 bottom = mix(vec3(.25,.05,.08), vec3(.5,.05,.05), hue);
      vec3 col = mix(bottom, top, y);
      float swirl = sin(dir.x*8. + t) * sin(dir.z*8. + t*1.3) * .03;
      col += swirl;
      gl_FragColor = vec4(col, 1.);
    }`
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

/* Clouds — layers of dark crimson */
const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0x1a0404, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });
for (let i = 0; i < 6; i++) {
  const g = new THREE.PlaneGeometry(rnd(60, 140), rnd(30, 70));
  const m = new THREE.Mesh(g, cloudMat.clone());
  m.position.set(rnd(-120, 120), rnd(30, 70), rnd(-140, -60));
  m.rotation.x = -PI * .2;
  scene.add(m);
  clouds.push(m);
}

/* ============================================================
   RUINED ROYAL PALACE
   ============================================================ */
const palace = new THREE.Group();
scene.add(palace);

const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, roughness: .85, metalness: .1 });
const stoneDark = new THREE.MeshStandardMaterial({ color: 0x0f0505, roughness: .9 });
const stoneLight = new THREE.MeshStandardMaterial({ color: 0x4a3838, roughness: .8 });

/* Ground */
const floorGeo = new THREE.CircleGeometry(120, 64);
const floorMesh = new THREE.Mesh(floorGeo, stoneMat);
floorMesh.rotation.x = -PI / 2;
floorMesh.position.y = -0.02;
palace.add(floorMesh);

/* Cracked ring platform under fight */
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8 + i * 5, 9 + i * 5, 32, 1),
    stoneDark
  );
  ring.rotation.x = -PI / 2;
  ring.position.y = .01 + i * .01;
  palace.add(ring);
}

/* Broken pillars — some standing, some tilted, some lying */
const pillars = [];
for (let i = 0; i < 24; i++) {
  const a = rnd(0, PI * 2);
  const r = rnd(15, 60);
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const h = rnd(4, 14);
  const broken = Math.random() < .6;
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(rnd(.4, .7), rnd(.6, 1), h, 8),
    Math.random() < .5 ? stoneLight : stoneDark
  );
  pillar.position.set(x, h / 2, z);
  if (broken) {
    pillar.rotation.z = rnd(-.6, .6);
    pillar.rotation.x = rnd(-.5, .5);
    pillar.position.y = Math.max(h * .3, 1);
  }
  palace.add(pillar);
  pillars.push(pillar);
}

/* Ruined walls — large broken slabs */
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * PI * 2 + rnd(-.3, .3);
  const r = rnd(35, 55);
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(rnd(6, 14), rnd(4, 12), rnd(.6, 1.2)),
    stoneDark
  );
  wall.position.set(Math.cos(a) * r, rnd(1, 6), Math.sin(a) * r);
  wall.rotation.y = -a + rnd(-.3, .3);
  wall.rotation.z = rnd(-.2, .2);
  palace.add(wall);
}

/* Floating debris — big blocks */
const debris = [];
for (let i = 0; i < 20; i++) {
  const size = rnd(.6, 2.5);
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(size, size * rnd(.5, 1.2), size),
    Math.random() < .5 ? stoneLight : stoneDark
  );
  block.position.set(rnd(-40, 40), rnd(6, 35), rnd(-40, 40));
  block.rotation.set(rnd(0, PI), rnd(0, PI), rnd(0, PI));
  palace.add(block);
  debris.push({ mesh: block, baseY: block.position.y, sp: rnd(.2, .8), rotSp: rnd(.2, .8) });
}

/* Broken throne on a raised dais */
const dais = new THREE.Group();
const daisBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 1.2, 12), stoneDark);
daisBase.position.y = .6; dais.add(daisBase);
const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, .3, 12), stoneLight);
daisTop.position.y = 1.35; dais.add(daisTop);
dais.position.set(0, 0, -12);
palace.add(dais);

/* Corpse particles — tiny embers rising */
const emberGeo = new THREE.BufferGeometry();
const emberCount = 500;
const emberPos = new Float32Array(emberCount * 3);
const emberVel = new Float32Array(emberCount * 3);
for (let i = 0; i < emberCount; i++) {
  emberPos[i*3] = rnd(-60, 60);
  emberPos[i*3+1] = rnd(0, 30);
  emberPos[i*3+2] = rnd(-60, 60);
  emberVel[i*3] = rnd(-.2, .2);
  emberVel[i*3+1] = rnd(.3, 1.0);
  emberVel[i*3+2] = rnd(-.2, .2);
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const emberMat = new THREE.PointsMaterial({
  color: 0xff5520, size: .15, map: glowTex, blending: AD, transparent: true,
  depthWrite: false, opacity: .9
});
const embers = new THREE.Points(emberGeo, emberMat);
scene.add(embers);

/* ============================================================
   AIZEN MODEL
   ============================================================ */
function makeBleachCharacter(opts) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({
    color: c, roughness: o.r ?? .55, metalness: o.m ?? .1,
    emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 0,
    side: o.side ?? THREE.FrontSide
  });
  const skinM = M(opts.skin, {r: .5});
  const topM = M(opts.top, {r: .5});
  const pantsM = M(opts.pants, {r: .65});
  const hairM = M(opts.hair, {r: .35});
  const bootM = M(opts.boots, {r: .4});
  const eyeM = new THREE.MeshBasicMaterial({ color: opts.eye });
  const grp = (p,x,y,z)=>{const q=new THREE.Group();q.position.set(x,y,z);p.add(q);return q;};

  const hips = grp(g, 0, 1.05, 0);
  const torso = grp(hips, 0, .05, 0);

  /* Lower + upper torso taper */
  const lowerTorso = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .32, 10), topM);
  lowerTorso.position.y = .16; torso.add(lowerTorso);
  const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(.30, .22, .35, 10), topM);
  upperTorso.position.y = .48; torso.add(upperTorso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(.34, .08, .04), topM);
  chest.position.set(0, .56, .19); torso.add(chest);

  /* Long coat tails — Aizen-style shihakusho */
  if (opts.style === 'aizen') {
    for (const s of [1, -1]) {
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(.32, .95, 1, 4), M(opts.top, {r: .5, side: THREE.DoubleSide}));
      tail.position.set(s * .15, -.42, .02); tail.rotation.x = .18; torso.add(tail);
    }
    /* White captain haori over the shihakusho */
    const haori = new THREE.Mesh(
      new THREE.CylinderGeometry(.36, .34, 1.1, 12, 1, true),
      M(0xf5f0e8, {r: .55, side: THREE.DoubleSide})
    );
    haori.position.y = -.05; torso.add(haori);
    /* Captain's "5" on back */
    const capMark = new THREE.Mesh(new THREE.PlaneGeometry(.1, .15), M(0x1a1a1a));
    capMark.position.set(0, .1, .36); capMark.rotation.y = 0; torso.add(capMark);
    /* Glasses */
    const glassesFrame = new THREE.Mesh(new THREE.TorusGeometry(.11, .006, 4, 16), M(0x222222));
    glassesFrame.position.set(0, .14, .15); glassesFrame.rotation.x = PI / 2; glassesFrame.scale.set(1, .6, 1);
    // head is added later — attach to head
  }

  /* Yhwach: black cloak with high collar */
  if (opts.style === 'yhwach') {
    const cape = new THREE.Mesh(
      new THREE.CylinderGeometry(.42, .55, 1.3, 14, 1, true),
      M(0x0a0202, {r: .7, side: THREE.DoubleSide})
    );
    cape.position.y = -.15; torso.add(cape);
    /* high collar */
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(.35, .28, .35, 12, 1, true),
      M(0x0a0202, {r: .7, side: THREE.DoubleSide})
    );
    collar.position.y = .72; torso.add(collar);
    /* Silver cross pendant */
    const pendant = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .02), M(0xd8d8d8, {m: .9}));
    pendant.position.set(0, .5, .19); torso.add(pendant);
    /* Mustache */
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(.1, .02, .02), M(opts.hair));
    mustache.position.set(0, .04, .16); torso.add(mustache);
  }

  /* Neck */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .14, 8), skinM);
  neck.position.y = .68; torso.add(neck);

  /* Head */
  const head = grp(torso, 0, .92, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.17, 24, 18), skinM);
  skull.position.y = .1; skull.scale.set(.95, 1.08, .95); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10, 0, PI*2, PI*.55, PI*.45), skinM);
  jaw.position.y = .04; head.add(jaw);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(.028, .045, .028), skinM);
  nose.position.set(0, .11, .165); head.add(nose);

  /* Hair cap */
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.18, 24, 18, 0, PI*2, 0, PI*.6), hairM);
  hairCap.position.y = .1; head.add(hairCap);

  /* Aizen's swept-back hair */
  if (opts.hairStyle === 'aizen') {
    for (let i = 0; i < 7; i++) {
      const a = -PI*.5 + (i / 6) * PI;
      const streak = new THREE.Mesh(new THREE.ConeGeometry(.05, .22, 5), hairM);
      streak.position.set(Math.cos(a) * .12, .18, Math.sin(a) * .08 - .06);
      streak.rotation.x = -.4; streak.rotation.z = -Math.cos(a) * .3;
      head.add(streak);
    }
    /* Forehead hair curl */
    const curl = new THREE.Mesh(new THREE.TorusGeometry(.07, .015, 4, 12, PI * 1.5), hairM);
    curl.position.set(.05, .18, .14); curl.rotation.z = .8; head.add(curl);
  }

  /* Yhwach's long black hair */
  if (opts.hairStyle === 'yhwach') {
    for (let i = 0; i < 10; i++) {
      const a = -PI * .4 + (i / 9) * PI * .8;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(.035, .02, .45, 5), hairM);
      strand.position.set(Math.cos(a) * .13, .06, Math.sin(a) * .1 - .08);
      strand.rotation.x = .8; strand.rotation.z = -Math.cos(a) * .2;
      head.add(strand);
    }
  }

  /* Eyes */
  const eyes = [];
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 12, 10), eyeM);
    eye.position.set(s * .065, .13, .155); head.add(eye);
    eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.055, .012, .01), hairM);
    brow.position.set(s * .065, .17, .16); brow.rotation.z = -s * .18; head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.08, .012, .01), new THREE.MeshBasicMaterial({ color: 0x301010 }));
  mouth.position.set(0, .04, .16); head.add(mouth);

  /* Attach glasses to head for Aizen */
  if (opts.style === 'aizen') {
    const glassesFrame = new THREE.Mesh(
      new THREE.TorusGeometry(.12, .007, 4, 16),
      M(0x222222, {r: .2, m: .8})
    );
    glassesFrame.position.set(0, .14, .155); glassesFrame.rotation.x = PI / 2; glassesFrame.scale.set(1, .55, 1);
    head.add(glassesFrame);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .01), M(0x222222));
    bridge.position.set(0, .14, .18); head.add(bridge);
  }

  /* Arms */
  const arm = s => {
    const sh = grp(torso, s * .37, .68, 0);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), topM));
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .24, 4, 8), topM);
    upper.position.y = -.19; sh.add(upper);
    const el = grp(sh, 0, -.36, 0);
    el.add(new THREE.Mesh(new THREE.CapsuleGeometry(.065, .26, 4, 8), skinM)).position.y = -.19;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.11, .09, .16, 10), topM);
    cuff.position.y = -.09; el.add(cuff);
    const hand = grp(el, 0, -.38, 0);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), skinM);
    fist.position.y = -.02; fist.scale.set(1, .85, 1.15); hand.add(fist);
    return { sh, el, hand };
  };
  const armL = arm(1), armR = arm(-1);

  /* Legs */
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

  /* Sword (katana) */
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(.06, 1.4, .015),
    new THREE.MeshStandardMaterial({ color: 0xdde5f0, metalness: .95, roughness: .15, emissive: 0x223344, emissiveIntensity: .3 })
  );
  blade.position.y = -.7; sword.add(blade);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .28, 8), M(0x1a0a0a));
  hilt.position.y = .12; sword.add(hilt);
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .025, 12), M(0x8a7030, {m: .9, r: .2}));
  guard.position.y = .02; sword.add(guard);
  armR.hand.add(sword);
  sword.position.y = -.05; sword.rotation.x = PI / 2;

  const c = {
    g, hips, torso, head, armL, armR, legL, legR, sword,
    L: armL, R: armR, lL: legL, lR: legR, p: g.position,
    cur: {}, vel: {}, tgt: {},
    ret: 0, yaw: 0, yawTgt: 0, pv: new V(), spd: 0,
    hd: 0, tilt: 0, tiltTgt: 0, eyes,
    breathe: Math.random() * PI * 2
  };
  scene.add(g);
  return c;
}

/* ============================================================
   POSES — Aizen & Yhwach
   ============================================================ */
const POSE = {
  idle:       { hy:0,   tx:0,   ty:0,   hdx:0,  lsx:-.15, lsz:.15, lel:-.4,  rsx:-.15, rsz:-.15, rel:-.4,  lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  walk:       { hy:0,   tx:.05, ty:0,   hdx:0,  lsx:-.2,  lsz:.15, lel:-.3,  rsx:-.2,  rsz:-.15, rel:-.3,  lhx:.3,  lkn:.2,  rhx:.3,  rkn:.2  },
  standTall:  { hy:0,   tx:-.05,ty:0,   hdx:0,  lsx:-.1,  lsz:.3,  lel:-.5,  rsx:-.1,  rsz:-.3,  rel:-.5,  lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  swordReady: { hy:-.05,tx:.15, ty:.2,  hdx:0,  lsx:-.5,  lsz:.2,  lel:-.5,  rsx:-.9,  rsz:-.2,  rel:0,    lhx:-.3, lkn:.4,  rhx:.2,  rkn:.2  },
  slash:      { hy:-.1, tx:.3,  ty:-.4, hdx:0,  lsx:-.4,  lsz:.1,  lel:-.5,  rsx:-1.5, rsz:-.4,  rel:0,    lhx:-.6, lkn:.7,  rhx:.4,  rkn:.1  },
  block:      { hy:-.05,tx:-.1, ty:.3,  hdx:0,  lsx:-1.2, lsz:.3,  lel:-.8,  rsx:-1.4, rsz:-.3,  rel:-.3,  lhx:-.2, lkn:.3,  rhx:.2,  rkn:.3  },
  raise:      { hy:0,   tx:-.15,ty:0,   hdx:-.15,lsx:-2.9,lsz:.5,  lel:-.3,  rsx:-2.9, rsz:-.5,  rel:-.3,  lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  raiseOne:   { hy:0,   tx:-.1, ty:0,   hdx:-.1,lsx:-.2, lsz:.2,  lel:-.4,  rsx:-2.8, rsz:-.6,  rel:-.3,  lhx:0,   lkn:.1,  rhx:0,   rkn:.1  },
  point:      { hy:-.05,tx:.1,  ty:-.3, hdx:0,  lsx:.2,   lsz:.1,  lel:-.3,  rsx:-1.55,rsz:-.1,  rel:0,    lhx:-.3, lkn:.4,  rhx:0,   rkn:.1  },
  swordUp:    { hy:0,   tx:-.1, ty:.2,  hdx:0,  lsx:-.3,  lsz:.2,  lel:-.4,  rsx:-2.5, rsz:-.3,  rel:-.3,  lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  sheathe:    { hy:0,   tx:.05, ty:0,   hdx:0,  lsx:-.2,  lsz:.15, lel:-.4,  rsx:-.4,  rsz:-.2,  rel:-.6,  lhx:0,   lkn:.15, rhx:0,   rkn:.15 },
  strike:     { hy:-.15,tx:.4,  ty:-.3, hdx:0,  lsx:-.4,  lsz:.2,  lel:-.3,  rsx:-1.7, rsz:-.2,  rel:-.1,  lhx:-.5, lkn:.6,  rhx:.3,  rkn:.2  }
};
const KEYS = ['hy','tx','ty','hdx','lsx','lsz','lel','rsx','rsz','rel','lhx','lkn','rhx','rkn'];

function setPose(c, name, hold = false) {
  c.tgt = POSE[name];
  c.ret = hold ? 0 : .3;
}

function updateFighter(f, pos, other, dt, time, moving = false) {
  f.p.set(pos.x, pos.y, pos.z);

  f.yawTgt = Math.atan2(other.p.x - f.p.x, other.p.z - f.p.z);
  f.yaw = alerp(f.yaw, f.yawTgt, 1 - Math.exp(-8 * dt));
  f.g.rotation.y = f.yaw;

  const speed = f.pv.distanceTo(f.p) / Math.max(dt, .001);
  f.spd = cl(speed / 9, 0, 1);
  f.pv.copy(f.p);
  if (moving) f.hd += dt * (6 + f.spd * 8);

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

  f.breathe += dt * 1.5;
  const breath = Math.sin(f.breathe) * .008 * (1 - f.spd);

  const sw = moving ? Math.sin(f.hd) * .6 * f.spd : 0;
  f.hips.position.y = 1.05 + c.hy + breath - f.spd * .04;
  f.torso.rotation.set(c.tx, c.ty, 0);
  f.head.rotation.x = c.hdx;
  f.L.sh.rotation.set(c.lsx, 0, c.lsz); f.L.el.rotation.x = c.lel;
  f.R.sh.rotation.set(c.rsx, 0, c.rsz); f.R.el.rotation.x = c.rel;
  f.lL.hp.rotation.x = c.lhx + sw; f.lL.kn.rotation.x = c.lkn + Math.max(0, -sw) * 1.1;
  f.lR.hp.rotation.x = c.rhx - sw; f.lR.kn.rotation.x = c.rkn + Math.max(0, sw) * 1.1;
}

function resetCharacter(f) {
  f.cur = { ...POSE.idle };
  f.tgt = POSE.idle;
  f.vel = {};
  for (const k of KEYS) { if (f.cur[k] === undefined) f.cur[k] = 0; f.vel[k] = 0; }
}

/* ============================================================
   BUILD CHARACTERS
   ============================================================ */
const aizen = makeBleachCharacter({
  skin: 0xf2e0d0, top: 0x0a0a0e, pants: 0x0a0a0e, hair: 0x2a1408,
  boots: 0x0a0505, eye: 0x8a2020, style: 'aizen', hairStyle: 'aizen'
});
resetCharacter(aizen);
aizen.g.position.set(0, 0, 20);
aizen.g.visible = false;

const yhwach = makeBleachCharacter({
  skin: 0xd8c8b8, top: 0x0a0202, pants: 0x0a0202, hair: 0x0a0202,
  boots: 0x080202, eye: 0x8a0000, style: 'yhwach', hairStyle: 'yhwach'
});
resetCharacter(yhwach);
yhwach.g.position.set(0, 0, -12);
yhwach.g.visible = false;

/* ============================================================
   FIVE DRAGONS — GORYŪTENMETSU
   ============================================================ */
const dragons = [];
function makeDragon(idx) {
  const dragonGroup = new THREE.Group();
  const segments = 18;
  const segMeshes = [];
  for (let i = 0; i < segments; i++) {
    const s = 1 - i / segments;
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(.35 * s + .15, 8, 6),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().lerpColors(new THREE.Color(0x4a0a0a), new THREE.Color(0xff3010), 1 - i / segments),
        transparent: true, opacity: .85, blending: AD, depthWrite: false
      })
    );
    dragonGroup.add(seg);
    segMeshes.push(seg);
  }
  // head
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(.5, 1.2, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4020, blending: AD, transparent: true, opacity: .95, depthWrite: false })
  );
  head.rotation.x = PI / 2; head.position.z = -.3;
  dragonGroup.add(head);
  // eyes
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
    eye.position.set(s * .2, .1, -.6);
    dragonGroup.add(eye);
  }
  scene.add(dragonGroup);
  dragonGroup.visible = false;
  return { group: dragonGroup, segs: segMeshes, head, phase: idx * (PI * 2 / 5), radius: 12 + idx * .5, height: 8 + idx * .3, visible: false };
}

for (let i = 0; i < 5; i++) dragons.push(makeDragon(i));

function updateDragons(dt, time, intensity) {
  for (let i = 0; i < dragons.length; i++) {
    const d = dragons[i];
    if (!d.visible) continue;
    const phase = d.phase + time * 1.2;
    const baseX = Math.cos(phase) * d.radius;
    const baseZ = Math.sin(phase) * d.radius;
    const baseY = d.height + Math.sin(time * 2 + i) * 1.5;
    // head follows circular path
    d.group.position.set(baseX, baseY, baseZ);
    // rotate to face direction
    d.group.rotation.y = -phase + PI / 2;

    // body segments trail behind
    for (let s = 0; s < d.segs.length; s++) {
      const t = s / d.segs.length;
      const tp = phase - t * 1.5 * intensity;
      const tx = Math.cos(tp) * d.radius;
      const tz = Math.sin(tp) * d.radius;
      const ty = d.height + Math.sin(time * 2 + i + t * 3) * 1.5 - t * 1.5;
      d.segs[s].position.set(tx - baseX, ty - baseY, tz - baseZ);
      d.segs[s].scale.setScalar(1 - t * .5);
    }
  }
}

/* ============================================================
   SOUL SOCIETY ILLUSION — appears briefly
   ============================================================ */
const soulSociety = new THREE.Group();
scene.add(soulSociety);
soulSociety.visible = false;

/* White walls of Seireitei */
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * PI * 2;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(3, 8, .5),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0, emissive: 0x808080, emissiveIntensity: .2, roughness: .8 })
  );
  wall.position.set(Math.cos(a) * 30, 4, Math.sin(a) * 30);
  wall.rotation.y = -a + PI / 2;
  soulSociety.add(wall);
}

/* First Division barracks — tall central building */
const barracks = new THREE.Mesh(
  new THREE.BoxGeometry(8, 14, 8),
  new THREE.MeshStandardMaterial({ color: 0xe8e8e8, emissive: 0x606060, emissiveIntensity: .25 })
);
barracks.position.y = 7;
soulSociety.add(barracks);

/* Distant skyline silhouettes */
for (let i = 0; i < 20; i++) {
  const a = rnd(0, PI * 2);
  const r = rnd(50, 90);
  const h = rnd(3, 12);
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(rnd(2, 6), h, rnd(2, 6)),
    new THREE.MeshBasicMaterial({ color: 0x505060 })
  );
  b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
  soulSociety.add(b);
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
const glowParticles = new ParticleSystem(3000, AD);

const spark = (p, n, spd, sz, t, c, g = 6) => {
  for (let i = 0; i < n; i++) {
    const v = rd().multiplyScalar(spd * rnd(.25, 1));
    glowParticles.e(p.x, p.y, p.z, v.x, v.y, v.z, sz * rnd(.5, 1.3), t * rnd(.6, 1.3), c[0], c[1], c[2], g, 1.4);
  }
};

/* ============================================================
   FX helpers
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
function impact(p, pw, c = [1.3, .5, .3]) {
  spark(p, Math.floor(25 * pw), 12 * pw, .4, .6, c, 8);
  sphereFX(p, 0xffdd88, 1.5 * pw, .25);
  ringFX(p, 0xffffff, 3.5 * pw, .3, true);
  lightFlash(p, 0xff8040, 300 * pw);
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
  const e = $('sub');
  if (!name && !text) { e.style.opacity = 0; return; }
  e.innerHTML = `<b>${name}</b>${text}`;
  e.style.opacity = 1;
  clearTimeout(subTimer); subTimer = setTimeout(() => e.style.opacity = 0, d * 1000);
}
function freeze(t) { hitStop = Math.max(hitStop, t); }

/* ============================================================
   DIALOGUE — spoken lines displayed with elegant fade
   ============================================================ */
function dialogueText(name, text, duration) {
  say(name, `<em>"${text}"</em>`, duration);
}

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

/* ============================================================
   TIMELINE
   ============================================================ */
const EVENTS = [];
const at = (t, fn) => EVENTS.push([t, fn]);

/* Camera state — mutated by shots */
let camPos = new V(0, 40, 80);
let camTarget = new V(0, 5, 0);
let camFov = 45;
let camRoll = 0;

/* Position state */
const aizenPos = new V(0, 0, 25);
const yhwachPos = new V(0, 0, -12);

/* ============================================================
   SCENE 01 — 00:00–00:30 — THE FALL OF THE ROYAL PALACE
   ============================================================ */
at(0, () => {
  flashScreen('#000', 1, 2.0);
  yhwach.g.visible = true;
  yhwach.g.position.copy(yhwachPos);
  showBanner('BLEACH', 'THE FINAL DECEPTION', 4);
  playSound('wind', 1);
  synthWind();
});

/* 00:00–00:07 — silence + drip */
at(3.5, () => {
  const e = $('sub');
  e.innerHTML = '<em>drip.</em>'; e.style.opacity = .9;
  setTimeout(() => { e.style.opacity = 0; }, 800);
  tone('sine', 2000, 1200, .1, .3);
});
at(4.5, () => {
  synthRumble();
  noise('lowpass', 200, 60, 5, .35, .6);
});

/* 00:07–00:20 — aerial shot of ruined palace */
/* camera: shot 0 */
addShot(0, 8, k => {
  setCam(
    lerp(0, 5, es(k)),
    lerp(45, 25, es(k)),
    lerp(90, 60, es(k)),
    0, 5, 0, lerp(40, 50, es(k))
  );
});

/* 00:20–00:30 — slow descent, Yhwach revealed */
addShot(8, 14, k => {
  setCam(
    lerp(5, 3, es(k)),
    lerp(25, 4, es(k)),
    lerp(60, 20, es(k)),
    0, 2, -10, lerp(50, 42, es(k))
  );
});

/* Yhwach line at 00:28 */
at(10.5, () => {
  setPose(yhwach, 'standTall', true);
  say('YHWACH', '<em>"Everything... has already been decided."</em>', 4);
});

/* ============================================================
   SCENE 02 — 00:30–01:00 — THE ARRIVAL OF AIZEN
   ============================================================ */
at(14, () => {
  playSound('wind', .6);
});

/* 00:30–00:38 — spiritual pressure, cut to Yhwach eyes */
at(15, () => {
  const e = $('chr');
  e.style.opacity = 1; e.style.transition = 'none';
  void e.offsetWidth;
  e.style.transition = 'opacity 2s';
  e.style.opacity = 0;
});

addShot(14, 18, k => {
  /* tight on Yhwach's head */
  const hp = yhwach.head.getWorldPosition(new V());
  setCam(hp.x + 1.5, hp.y + .2, hp.z + 2, hp.x, hp.y, hp.z, lerp(45, 35, k));
});

/* 00:38–00:48 — footsteps, silhouette of Aizen approaching */
at(18, () => {
  aizen.g.visible = true;
  aizen.g.position.set(0, 0, 40);
  setPose(aizen, 'walk', true);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      tone('sine', 400, 200, .06, .2);
      noise('highpass', 2000, 800, .05, .15);
    }, 1800 + i * 500);
  }
});

addShot(18, 24, k => {
  /* from behind Aizen — reveal slow pan */
  setCam(
    aizen.g.position.x + Math.sin(k * PI) * 3,
    lerp(1.8, 2.2, k),
    lerp(45, 30, k),
    aizen.g.position.x, 1.6, aizen.g.position.z - 5,
    lerp(38, 42, k)
  );
});

/* Aizen — "Well... how lonely." */
at(21, () => {
  dialogueText('AIZEN', 'Well...', 1.2);
});
at(22.3, () => {
  dialogueText('AIZEN', 'How lonely.', 1.8);
});

/* 00:48–01:00 — Yhwach turns, exchange of lines */
at(24, () => {
  setPose(yhwach, 'standTall', true);
});

addShot(24, 30, k => {
  /* alternating faces */
  const p = yhwach.head.getWorldPosition(new V());
  setCam(p.x + 1.5, p.y + .3, p.z + 2.2, p.x, p.y, p.z, 38);
});

at(25, () => {
  dialogueText('YHWACH', 'Sosuke Aizen.', 1.5);
});
at(26.7, () => {
  dialogueText('AIZEN', 'Your Majesty.', 1.5);
});
at(28.4, () => {
  dialogueText('AIZEN', 'Have you already forgotten how to welcome your guests?', 2.5);
});
at(31, () => {
  dialogueText('AIZEN', 'How disappointing.', 2);
});

/* ============================================================
   SCENE 03 — 01:00–01:40 — GORYŪTENMETSU
   ============================================================ */
at(33, () => {
  synthRumble();
  playSound('roar', .3);
});

/* Yhwach raises right hand */
addShot(30, 36, k => {
  setPose(yhwach, 'raiseOne', true);
  const p = yhwach.head.getWorldPosition(new V());
  setCam(p.x + 2, p.y + .2, p.z + 2.5, p.x, p.y - .2, p.z, 40);
});

at(34, () => {
  dialogueText('YHWACH', 'You should have remained imprisoned.', 2.5);
});
at(36.5, () => {
  dialogueText('AIZEN', 'Perhaps.', 1.2);
});
at(38, () => {
  dialogueText('AIZEN', 'But I have never been particularly fond of following instructions.', 3.2);
  setPose(aizen, 'standTall', true);
});

/* 01:09–01:25 — DRAGONS APPEAR */
at(40, () => {
  /* sky darkens */
  skyMat.uniforms.hue.value = 1;
  showBanner('GORYŪTENMETSU', '', 2);
  playSound('roar', 1);
  synthDragon();
  flashScreen('#400', .5, 1.5);
  for (const d of dragons) {
    d.visible = true;
    d.group.visible = true;
  }
  shake = 8;
});

addShot(40, 52, k => {
  /* sweeping shot around the dragons */
  const a = k * PI * 1.5;
  setCam(
    Math.sin(a) * 35,
    18 + Math.sin(k * PI * 2) * 3,
    Math.cos(a) * 35,
    0, 12, 0, lerp(55, 45, k)
  );
});

at(44, () => {
  /* dialogue at peak of Goryūtenmetsu */
  say('', '<em>GORYŪTENMETSU!</em>', 2);
});

/* 01:26 — convergence to Aizen */
at(52, () => {
  setPose(yhwach, 'strike', true);
  flashScreen('#f40', .8, .5);
  shake = 12;
  synthDragon();
});

addShot(52, 56, k => {
  /* five dragons converge on Aizen */
  setCam(
    aizen.g.position.x + 4,
    lerp(4, 3, k),
    lerp(22, 18, k),
    aizen.g.position.x, 2, aizen.g.position.z, 55
  );
});

at(55, () => {
  /* BOOM */
  flashScreen('#fff', 1, 1.5);
  playSound('nuke');
  shake = 20;
  freeze(.3);
  for (const d of dragons) {
    spark(d.group.position, 60, 25, .8, 1.5, [1.5, .4, .1], 3);
    d.visible = false; d.group.visible = false;
  }
  for (let i = 0; i < 8; i++) {
    const p = aizen.g.position.clone().add(new V(rnd(-8, 8), rnd(1, 4), rnd(-4, 4)));
    sphereFX(p, 0xff5020, 15, 1.5);
    ringFX(p, 0xff6020, 25, 1.2, true);
  }
});

at(57, () => {
  /* dust cloud */
  for (let i = 0; i < 60; i++) {
    const p = aizen.g.position.clone().add(rd().multiplyScalar(rnd(2, 12)));
    spark(p, 1, 8, .6, 2, [.4, .3, .2], 0);
  }
});

/* Camera reveals dust covered battlefield */
addShot(56, 60, k => {
  setCam(
    lerp(4, 2, k),
    lerp(3, 2.5, k),
    lerp(18, 15, k),
    aizen.g.position.x, 2, aizen.g.position.z, 42
  );
});

/* YHWACH: "That should have been enough." */
at(58, () => {
  dialogueText('YHWACH', 'That should have been enough.', 2.5);
});

/* AIZEN: "Was it?" — appears behind Yhwach */
at(60.5, () => {
  aizen.g.position.set(0, 0, -6);
  setPose(aizen, 'standTall', true);
  dialogueText('AIZEN', 'Was it?', 2);
  playSound('slash', .5);
});

/* ============================================================
   SCENE 04 — 01:40–02:15 — WELCOME TO THE SOUL SOCIETY
   ============================================================ */
addShot(60, 66, k => {
  /* over Yhwach shoulder at Aizen */
  const yp = yhwach.head.getWorldPosition(new V());
  setCam(
    yp.x + 3, yp.y + 1, yp.z + 3,
    aizen.g.position.x, 1.8, aizen.g.position.z, 42
  );
});

at(63, () => {
  dialogueText('AIZEN', 'Tell me, Yhwach...', 1.8);
});
at(65, () => {
  dialogueText('AIZEN', 'Do you know what I find particularly amusing?', 2.5);
});

addShot(66, 72, k => {
  /* Aizen walks past Yhwach — tracking shot */
  setCam(
    lerp(6, 3, k), 2, lerp(2, -3, k),
    0, 1.8, -5, 45
  );
});

at(68, () => {
  dialogueText('YHWACH', 'Speak.', 1.2);
});

/* 01:49–02:05 — Soul Society vision */
at(70, () => {
  soulSociety.visible = true;
  soulSociety.position.set(0, -20, -60);
  soulSociety.scale.setScalar(.3);
  soulSociety.traverse(o => {
    if (o.isMesh && o.material) {
      o.material.transparent = true;
      o.material.opacity = 0;
    }
  });
  const e = $('chr');
  e.style.opacity = .5;
  e.style.transition = 'opacity 1s';
});

/* Fade in the illusion */
let soulSocietyFadeT = 0;
let soulSocietyFadeing = false;

at(70.5, () => { soulSocietyFadeing = true; soulSocietyFadeT = 0; });

/* 02:05 — "Welcome to the Soul Society." */
at(72, () => {
  dialogueText('AIZEN', 'Welcome...', 1.5);
});
at(74, () => {
  dialogueText('AIZEN', 'TO THE SOUL SOCIETY.', 2.5);
  flashScreen('#fff', .6, 1);
  playSound('roar', .4);
});

/* Music hit — the illusion distorts */
at(75, () => {
  const e = $('chr');
  e.style.opacity = .9;
  e.style.transition = 'opacity .5s';
  setTimeout(() => { e.style.opacity = 0; }, 1500);
  shake = 5;
});

at(76, () => {
  dialogueText('YHWACH', 'Kyōka Suigetsu...', 1.5);
});
at(77.5, () => {
  dialogueText('AIZEN', 'At least you remember.', 2);
});

/* Soul Society vanishes */
at(78, () => {
  soulSocietyFadeing = false;
  soulSociety.visible = false;
  const e = $('chr'); e.style.opacity = 0;
});

/* ============================================================
   SCENE 05 — 02:15–03:00 — THE FIRST CLASH
   ============================================================ */
at(79, () => {
  /* Yhwach activates Almighty */
  const e = yhwach.eyes[0].material;
  e.color.setHex(0xff2020);
  showBanner('THE ALMIGHTY', '', 2);
  flashScreen('#600', .5, 1);
  synthDeep();
  playSound('domain', .3);
});

addShot(79, 83, k => {
  /* extreme close-up of Yhwach's eyes */
  const hp = yhwach.head.getWorldPosition(new V());
  setCam(hp.x, hp.y, hp.z + .5, hp.x, hp.y, hp.z, lerp(50, 30, k));
});

at(81, () => {
  dialogueText('YHWACH', 'Your illusions will not save you.', 2.5);
});

at(83, () => {
  /* multiple Aizen reflections in eyes — FX */
  const hp = yhwach.head.getWorldPosition(new V());
  for (let i = 0; i < 3; i++) {
    const ref = new THREE.Mesh(
      new THREE.CircleGeometry(.6, 16),
      new THREE.MeshBasicMaterial({ color: 0x302020, transparent: true, opacity: .4, blending: AD, depthWrite: false })
    );
    ref.position.copy(hp).add(new V(rnd(-.4, .4), rnd(-.2, .2), .22));
    ref.lookAt(cam.position);
    scene.add(ref);
    let t = 0;
    fxList.push(dt => { t += dt; ref.material.opacity = Math.max(0, .4 - t * .4); if (t > 1) { scene.remove(ref); ref.material.dispose(); return false; } return true; });
  }
});

at(84, () => {
  dialogueText('AIZEN', 'Illusions?', 1.2);
  setPose(aizen, 'swordReady', true);
});
at(85.5, () => {
  dialogueText('AIZEN', 'How interesting.', 2);
});

/* 02:26 — first clash */
at(87, () => {
  const p = aizen.head.getWorldPosition(new V());
  impact(p.clone().add(new V(-1, -.4, 0)), 3);
  flashScreen('#fff', .7, .5);
  playSound('clash');
  synthClash();
  shake = 10;
  freeze(.1);
  setPose(aizen, 'block');
  setPose(yhwach, 'slash');
});

/* Yhwach next to Aizen, exchange of strikes */
addShot(87, 100, k => {
  /* fast rotating around the two */
  const a = k * PI * 3;
  setCam(
    Math.sin(a) * 5,
    2 + Math.sin(k * PI * 3) * .5,
    Math.cos(a) * 5,
    0, 1.8, 0, 42
  );
});

/* Series of sword strikes */
for (let i = 0; i < 6; i++) {
  at(89 + i * 1.4, () => {
    const pt = aizen.head.getWorldPosition(new V());
    impact(pt.clone().add(rd().multiplyScalar(1.5)), 1.8, [1.5, .8, .5]);
    playSound('clash', .8);
    synthClash();
    setPose(aizen, i % 2 ? 'block' : 'slash');
    setPose(yhwach, i % 2 ? 'slash' : 'block');
    shake = Math.max(shake, 5);
  });
}

/* 02:41–02:52 — Aizen launches, lands on floating debris */
at(99, () => {
  aizen.g.position.set(0, 6, 0);
  setPose(aizen, 'land');
  flashScreen('#a06080', .4, .8);
});

addShot(99, 106, k => {
  setCam(
    lerp(5, 2, k),
    lerp(2, 8, k),
    lerp(8, 5, k),
    aizen.g.position.x, aizen.g.position.y, aizen.g.position.z, 45
  );
});

/* Yhwach appears directly in front of Aizen */
at(102, () => {
  yhwach.g.position.set(aizen.g.position.x + 1, aizen.g.position.y, aizen.g.position.z - 2);
  setPose(yhwach, 'slash');
  setPose(aizen, 'block');
  const pt = aizen.head.getWorldPosition(new V());
  impact(pt.clone().add(new V(0, -.5, 0)), 4, [1.5, .5, .5]);
  playSound('clash', 1);
  synthClash();
  flashScreen('#fff', .9, .6);
  freeze(.15);
  shake = 15;
});

/* 360° rotation around them */
addShot(102, 110, k => {
  const a = k * PI * 2;
  const cx = (aizen.g.position.x + yhwach.g.position.x) / 2;
  const cy = 2.5;
  const cz = (aizen.g.position.z + yhwach.g.position.z) / 2;
  setCam(
    cx + Math.sin(a) * 5,
    cy + 1,
    cz + Math.cos(a) * 5,
    cx, cy, cz, 42
  );
});

at(105, () => {
  dialogueText('YHWACH', 'You cannot defeat me.', 2);
});
at(107.5, () => {
  dialogueText('AIZEN', 'Is that so?', 1.8);
});

/* 02:53–03:00 — separation */
at(110, () => {
  setPose(aizen, 'idle');
  setPose(yhwach, 'idle');
  aizen.g.position.set(3, 0, 4);
  yhwach.g.position.set(-2, 3, -6);
});

addShot(110, 116, k => {
  setCam(
    lerp(2, 5, es(k)),
    lerp(3, 2.5, k),
    lerp(5, 10, k),
    0, 2, 0, lerp(42, 50, k)
  );
});

at(112, () => {
  dialogueText('AIZEN', 'Then let us find out...', 2);
});
at(114.5, () => {
  dialogueText('AIZEN', '...how far your Almighty can actually see.', 3);
});

/* Cut to black */
at(117, () => {
  flashScreen('#000', 1, 1.5);
  playSound('wind', 1);
  synthWind();
});

/* End screen */
at(118.5, () => {
  const en = $('en'); en.style.display = 'flex'; requestAnimationFrame(() => en.style.opacity = 1);
});

/* Extend to 3 min hold */
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
  if (hitStop > 0) {
    hitStop -= rawDt;
    dt = 0;
  }

  if (running && dt > 0) T += dt;

  while (running && eventIdx < EVENTS.length && EVENTS[eventIdx][0] <= T) {
    EVENTS[eventIdx][1]();
    eventIdx++;
  }

  /* Update characters */
  if (aizen.g.visible) updateFighter(aizen, aizen.g.position, yhwach, dt, T, T > 18 && T < 24);
  if (yhwach.g.visible) updateFighter(yhwach, yhwach.g.position, aizen, dt, T, false);

  /* Dragons */
  updateDragons(dt, T, 1);

  /* Embers rise */
  const ep = emberGeo.attributes.position.array;
  for (let i = 0; i < emberCount; i++) {
    ep[i*3+1] += emberVel[i*3+1] * dt;
    ep[i*3] += emberVel[i*3] * dt;
    ep[i*3+2] += emberVel[i*3+2] * dt;
    if (ep[i*3+1] > 35) { ep[i*3+1] = 0; ep[i*3] = rnd(-60, 60); ep[i*3+2] = rnd(-60, 60); }
  }
  emberGeo.attributes.position.needsUpdate = true;

  /* Debris float */
  for (const d of debris) {
    d.mesh.position.y = d.baseY + Math.sin(T * d.sp) * 1.2;
    d.mesh.rotation.x += d.rotSp * dt * .3;
    d.mesh.rotation.y += d.rotSp * dt * .4;
  }

  /* Clouds drift */
  for (const c of clouds) {
    c.position.x += dt * .3;
    if (c.position.x > 130) c.position.x = -130;
  }

  /* Soul Society fade */
  if (soulSocietyFadeing) {
    soulSocietyFadeT += dt;
    const k = Math.min(1, soulSocietyFadeT / 2);
    soulSociety.traverse(o => {
      if (o.isMesh && o.material) o.material.opacity = k * .7;
    });
  }

  /* Update camera from shot list */
  let camUpdated = false;
  for (const s of CAMERA_SHOTS) {
    if (T >= s[0] && T < s[1]) {
      s[2]((T - s[0]) / (s[1] - s[0]));
      camUpdated = true;
      break;
    }
  }
  if (!camUpdated && T > 116) {
    setCam(3, 2, 8, 0, 2, 0, 45);
  }

  /* Shake */
  if (shake > .01) {
    const q = cam.quaternion.clone();
    cam.position.x += rnd(-1, 1) * shake * .15;
    cam.position.y += rnd(-1, 1) * shake * .15;
    cam.position.z += rnd(-1, 1) * shake * .15;
    cam.quaternion.copy(q);
    shake *= Math.exp(-8 * rawDt);
  }
  cam.updateProjectionMatrix();

  /* CA decay */
  if (caPass) {
    caPass.uniforms.amount.value *= Math.exp(-5 * rawDt);
    caPass.uniforms.time.value += rawDt;
  }

  /* Combat light decay */
  combatLightI *= Math.exp(-10 * rawDt);
  combatLight.intensity = combatLightI;

  /* Update sky uniforms */
  skyMat.uniforms.t.value += rawDt * .2;

  /* FX */
  for (let i = fxList.length - 1; i >= 0; i--) if (!fxList[i](rawDt)) fxList.splice(i, 1);
  glowParticles.u(rawDt);

  /* Particle scale */
  const sc = renderer.domElement.height / (2 * Math.tan(cam.fov * PI / 360));
  glowParticles.m.uniforms.sc.value = sc;

  if (composer) composer.render();
  else renderer.render(scene, cam);
}

/* ============================================================
   START
   ============================================================ */
$('go').addEventListener('click', async () => {
  const btn = $('go');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  await preloadAudio();
  await initSynthAudio();

  const ok = Object.values(AUDIO_OK).filter(Boolean).length;
  console.log(`[audio] ${ok}/${audioTotal} loaded`);

  $('st').style.display = 'none';
  try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}

  setTimeout(() => {
    layout();
    T = 0; eventIdx = 0; running = true;
    shake = 0; combatLightI = 0; hitStop = 0;

    /* Reset characters */
    aizen.g.position.set(0, 0, 40); aizen.g.visible = false;
    yhwach.g.position.set(0, 0, -12); yhwach.g.visible = false;
    resetCharacter(aizen); resetCharacter(yhwach);

    /* Reset dragons */
    for (const d of dragons) { d.visible = false; d.group.visible = false; }

    /* Reset soul society */
    soulSociety.visible = false;
    soulSocietyFadeing = false;

    /* Sky */
    skyMat.uniforms.hue.value = 0;
    $('chr').style.opacity = 0;

    /* Particles */
    for (let i = 0; i < glowParticles.max; i++) { glowParticles.l[i] = 0; glowParticles.s[i] = 0; }
  }, 350);
});

$('re').addEventListener('click', () => location.reload());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(frame);