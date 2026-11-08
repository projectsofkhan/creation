// ═══════════════════════════════════════════════════════════════
//  engine.js — v2.1 FINAL
//  Complete boot with player rig, all systems wired.
//  Replaces: engine.js (all prior versions)
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { terrainHeight } from './terrain.js';
import { MATS } from './materials.js';
import { createWorld } from './world.js';
import { PlantManager } from './plants.js';
import { HandManager, performAction, initDirtParticles, updateDirtParticles } from './tools.js';
import { HorseManager } from './horse.js';
import { createPlayer, updatePlayerAnimation } from './player.js';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
export const EYE_HEIGHT = 1.62;
export const WALK_SPEED = 3.2;
export const RUN_SPEED = 5.8;
export const JUMP_VELOCITY = 5.0;
export const GRAVITY = 18;
export const PLAYER_RADIUS = 0.35;
export const DAY_LENGTH = 480;

// ═══════════════════════════════════════════════════════════════
//  QUALITY TIERS
// ═══════════════════════════════════════════════════════════════
function detectQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  if (mobile && (cores < 6 || dpr > 2.5)) return 'low';
  if (mobile || cores < 4) return 'medium';
  return 'high';
}
const QUALITY = detectQuality();
const Q = {
  low:    { pixelRatio: 1.0, shadows: false, shadowMap: 0,    bloom: false, view: 2 },
  medium: { pixelRatio: 1.5, shadows: true,  shadowMap: 1024, bloom: true,  view: 3 },
  high:   { pixelRatio: 2.0, shadows: true,  shadowMap: 2048, bloom: true,  view: 3 },
}[QUALITY];
console.log(`[Verdant Vale] quality=${QUALITY}`);

// ═══════════════════════════════════════════════════════════════
//  GAME STATE — single source of truth
// ═══════════════════════════════════════════════════════════════
export const gameState = {
  player: {
    position: new THREE.Vector3(0, 0, 8),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    onGround: true,
    eyeHeight: EYE_HEIGHT,
    moveAmt: 0,
    runBlend: 0,
    headBob: 0,
    coins: 120,
    water: 15,
    waterMax: 15,
    harvest: 0,
    seeds: { tomato: 5, carrot: 3, potato: 2, corn: 0, lettuce: 0, strawberry: 0 },
    heldItem: 'hand',
  },
  world: { timeOfDay: 0.30, day: 1, weather: 'clear' },
  camera: { baseFOV: 62, currentFOV: 62, shake: 0 },
  paused: false,
  started: false,
  horse: { mounted: false, happy: 0.65 },
  interaction: { target: null, prompt: '' },
};

// ═══════════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════════
export const Input = {
  keys: Object.create(null),
  mouse: { dx: 0, dy: 0, locked: false },
  touch: { joystick: { active: false, x: 0, y: 0 } },
  touchLook: { dx: 0, dy: 0 },
  wantsPrimary: false,
  wantsJump: false,
  wantsInteract: false,
  reset() {
    this.mouse.dx = 0; this.mouse.dy = 0;
    this.touchLook.dx = 0; this.touchLook.dy = 0;
    this.wantsPrimary = false;
    this.wantsJump = false;
    this.wantsInteract = false;
  },
};

// ═══════════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════════
export const Audio = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  musicPlaying: false, musicVol: 0.4, sfxVol: 0.7, ready: false,

  init() {
    if (this.ready) return;
    this.ready = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 1; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol * 0.5; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol * 0.7; this.sfxGain.connect(this.master);
    } catch (e) { console.warn('Audio init failed', e); }
  },
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); },
  tone(freq = 440, dur = 0.3, type = 'sine', vol = 0.06) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur);
  },
  footstep(run = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 380;
    o.type = 'sine';
    o.frequency.setValueAtTime(run ? 85 : 65, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.09);
    g.gain.setValueAtTime(run ? 0.10 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.14);
  },
  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.sampleRate * 0.4;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.09;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },
  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    const prog = [
      [110, 164.81, 220, 277.18],
      [92.5, 138.59, 185, 220],
      [73.42, 110, 146.83, 185],
      [82.41, 123.47, 164.81, 207.65],
    ];
    let i = 0;
    const pad = () => {
      if (!this.musicPlaying) return;
      const t = this.ctx.currentTime;
      const chord = prog[i++ % prog.length];
      for (const freq of chord) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.4;
        o.type = 'sine'; o.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.002);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.022, t + 3);
        g.gain.linearRampToValueAtTime(0.018, t + 6.5);
        g.gain.linearRampToValueAtTime(0, t + 8);
        o.connect(f); f.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t + 8.2);
      }
      setTimeout(pad, 8000);
    };
    pad();
  },
  stopMusic() { this.musicPlaying = false; },
  setMusicVolume(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v * 0.5; },
  setSFXVolume(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v * 0.7; },
};

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD
// ═══════════════════════════════════════════════════════════════
const SAVE_KEY = 'verdant-vale-v2';
export const Save = {
  save() {
    try {
      const p = gameState.player, w = gameState.world;
      const data = {
        v: 2,
        player: {
          position: [p.position.x, p.position.y, p.position.z],
          yaw: p.yaw, pitch: p.pitch,
          coins: p.coins, water: p.water, harvest: p.harvest,
          seeds: { ...p.seeds }, heldItem: p.heldItem,
        },
        world: { timeOfDay: w.timeOfDay, day: w.day, weather: w.weather },
        horse: { happy: gameState.horse.happy },
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  apply(data) {
    if (!data) return false;
    try {
      const p = gameState.player, w = gameState.world;
      if (data.player) {
        if (data.player.position) p.position.fromArray(data.player.position);
        p.yaw = data.player.yaw ?? 0;
        p.pitch = data.player.pitch ?? 0;
        p.coins = data.player.coins ?? 120;
        p.water = data.player.water ?? 15;
        p.harvest = data.player.harvest ?? 0;
        p.seeds = { ...p.seeds, ...data.player.seeds };
        p.heldItem = data.player.heldItem ?? 'hand';
      }
      if (data.world) {
        w.timeOfDay = data.world.timeOfDay ?? 0.30;
        w.day = data.world.day ?? 1;
        w.weather = data.world.weather ?? 'clear';
      }
      if (data.horse) gameState.horse.happy = data.horse.happy ?? 0.65;
      return true;
    } catch (e) { return false; }
  },
};

// ═══════════════════════════════════════════════════════════════
//  COLLISION
// ═══════════════════════════════════════════════════════════════
export const Collision = {
  boxes: [],
  add(box) { this.boxes.push(box); },
  clear() { this.boxes.length = 0; },
  resolve(x, z, radius) {
    let px = x, pz = z;
    for (const b of this.boxes) {
      const cx = Math.max(b.minX, Math.min(px, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.0001;
        if (d2 < 0.0001) {
          const toMinX = px - b.minX, toMaxX = b.maxX - px;
          const toMinZ = pz - b.minZ, toMaxZ = b.maxZ - pz;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) px = b.minX - radius;
          else if (m === toMaxX) px = b.maxX + radius;
          else if (m === toMinZ) pz = b.minZ - radius;
          else pz = b.maxZ + radius;
        } else {
          const push = (radius - d) / d;
          px += dx * push;
          pz += dz * push;
        }
      }
    }
    return { x: px, z: pz };
  },
};

// ═══════════════════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════════════════
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SENS_DESKTOP = 0.0022;
const SENS_TOUCH = 0.006;

function applyCamera(camera) {
  const p = gameState.player, c = gameState.camera;
  const bobY = p.moveAmt > 0.05 && p.onGround
    ? Math.sin(p.headBob) * 0.042 * p.moveAmt : 0;
  const bobX = p.moveAmt > 0.05 && p.onGround
    ? Math.cos(p.headBob * 0.5) * 0.018 * p.moveAmt : 0;

  // Camera at player position (which mirrors rig root) + eye height
  camera.position.set(
    p.position.x + bobX,
    p.position.y + p.eyeHeight + bobY,
    p.position.z
  );

  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.pitch);
  const q = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);

  if (c.shake > 0) {
    c.shake = Math.max(0, c.shake - 1 / 60);
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (Math.random() - 0.5) * c.shake * 0.05,
      (Math.random() - 0.5) * c.shake * 0.05,
      (Math.random() - 0.5) * c.shake * 0.05
    )));
  }
  camera.quaternion.copy(q);

  if (Math.abs(camera.fov - c.currentFOV) > 0.01) {
    camera.fov = c.currentFOV;
    camera.updateProjectionMatrix();
  }
}

// ═══════════════════════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════════════════════
export const HUD = {
  el: {}, toastTimer: null,
  init() {
    const ids = ['crosshair','prompt','toast','coinVal','waterVal','waterBar',
                 'harvestVal','clockDisplay','dayDisplay','weatherDisplay'];
    for (const id of ids) this.el[id] = document.getElementById(id);
  },
  refresh() {
    const p = gameState.player;
    if (this.el.coinVal) this.el.coinVal.textContent = p.coins;
    if (this.el.waterVal) this.el.waterVal.textContent = p.water;
    if (this.el.waterBar) this.el.waterBar.style.width = (p.water / p.waterMax * 100) + '%';
    if (this.el.harvestVal) this.el.harvestVal.textContent = p.harvest;
  },
  setPrompt(html) {
    const el = this.el.prompt;
    if (!el) return;
    if (html) {
      if (el._last !== html) { el.innerHTML = html; el._last = html; }
      el.classList.add('show');
    } else {
      el.classList.remove('show');
      el._last = null;
    }
  },
  toast(text, dur = 2400) {
    const el = this.el.toast;
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), dur);
  },
  clock(timeOfDay, day, weather) {
    const totalMin = timeOfDay * 24 * 60;
    const h = Math.floor(totalMin / 60), m = Math.floor(totalMin % 60);
    if (this.el.clockDisplay)
      this.el.clockDisplay.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    if (this.el.dayDisplay) this.el.dayDisplay.textContent = 'Day ' + day;
    if (this.el.weatherDisplay) {
      const icons = { clear:'☀️', cloudy:'⛅', rain:'🌧️', storm:'⛈️', fog:'🌫️', snow:'❄️' };
      this.el.weatherDisplay.textContent = (icons[weather] || '☀️') + ' ' + weather;
    }
  },
};

// ═══════════════════════════════════════════════════════════════
//  INPUT WIRING
// ═══════════════════════════════════════════════════════════════
function wireKeyboard() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    Input.keys[e.code] = true;
    if (e.code === 'Escape' && gameState.started) { togglePause(); return; }
    if (!gameState.started || gameState.paused) return;
    if (e.code === 'KeyE') { Input.wantsInteract = true; e.preventDefault(); }
    if (e.code === 'KeyF') Input.wantsPrimary = true;
    if (e.code === 'Space') { Input.wantsJump = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in Input.keys) Input.keys[k] = false; });
}

function wireMouse(renderer) {
  renderer.domElement.addEventListener('click', () => {
    if (!gameState.started || gameState.paused) return;
    if (!Input.mouse.locked && !('ontouchstart' in window)) {
      renderer.domElement.requestPointerLock?.();
      return;
    }
    Input.wantsPrimary = true;
  });
  document.addEventListener('pointerlockchange', () => {
    Input.mouse.locked = document.pointerLockElement === renderer.domElement;
  });
  document.addEventListener('mousemove', e => {
    if (Input.mouse.locked) {
      Input.mouse.dx += e.movementX;
      Input.mouse.dy += e.movementY;
    }
  });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
}

function wireTouch() {
  const joystick = document.getElementById('joystick');
  const stick = joystick?.querySelector('.stick');
  const lookPad = document.getElementById('lookPad');
  const btnPrimary = document.getElementById('btnPrimary');
  const btnJump = document.getElementById('btnJump');
  if (!joystick || !lookPad) return;

  let joyId = null, joyCenter = { x: 0, y: 0 };
  const JOY_MAX = 52;

  joystick.addEventListener('touchstart', e => {
    if (!gameState.started || gameState.paused) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = joystick.getBoundingClientRect();
    joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    joyId = t.identifier;
  }, { passive: false });

  joystick.addEventListener('touchmove', e => {
    if (joyId === null) return;
    e.preventDefault();
    for (const t of e.touches) {
      if (t.identifier !== joyId) continue;
      let dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y;
      const m = Math.hypot(dx, dy);
      if (m > JOY_MAX) { dx = dx / m * JOY_MAX; dy = dy / m * JOY_MAX; }
      if (stick) stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      Input.touch.joystick.active = true;
      Input.touch.joystick.x = dx / JOY_MAX;
      Input.touch.joystick.y = dy / JOY_MAX;
    }
  }, { passive: false });

  const endJoy = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      joyId = null;
      Input.touch.joystick.active = false;
      Input.touch.joystick.x = 0; Input.touch.joystick.y = 0;
      if (stick) stick.style.transform = 'translate(-50%, -50%)';
    }
  };
  joystick.addEventListener('touchend', endJoy);
  joystick.addEventListener('touchcancel', endJoy);

  let lookId = null, lastX = 0, lastY = 0;
  lookPad.addEventListener('touchstart', e => {
    if (!gameState.started || gameState.paused) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookId = t.identifier; lastX = t.clientX; lastY = t.clientY;
  }, { passive: false });

  lookPad.addEventListener('touchmove', e => {
    if (lookId === null) return;
    e.preventDefault();
    for (const t of e.touches) {
      if (t.identifier !== lookId) continue;
      Input.touchLook.dx += t.clientX - lastX;
      Input.touchLook.dy += t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: false });

  const endLook = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) { lookId = null; }
    }
  };
  lookPad.addEventListener('touchend', endLook);
  lookPad.addEventListener('touchcancel', endLook);

  btnPrimary?.addEventListener('touchstart', e => {
    if (!gameState.started || gameState.paused) return;
    e.preventDefault(); e.stopPropagation();
    Input.wantsInteract = true; Input.wantsPrimary = true;
    if ('vibrate' in navigator) navigator.vibrate(10);
  }, { passive: false });

  btnJump?.addEventListener('touchstart', e => {
    if (!gameState.started || gameState.paused) return;
    e.preventDefault(); e.stopPropagation();
    Input.wantsJump = true;
  }, { passive: false });
}

function togglePause() {
  gameState.paused = !gameState.paused;
  document.getElementById('pause')?.classList.toggle('show', gameState.paused);
  if (gameState.paused && document.pointerLockElement) document.exitPointerLock?.();
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
async function boot() {
  const $bar = document.getElementById('barFill');
  const $status = document.getElementById('loadStatus');
  const prog = (pct, label) => {
    if ($bar) $bar.style.width = pct + '%';
    if ($status && label) $status.textContent = label;
  };

  prog(5, 'creating renderer');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0xb8d8e8, 0.008);

  const camera = new THREE.PerspectiveCamera(
    gameState.camera.baseFOV, innerWidth / innerHeight, 0.08, 500
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: QUALITY !== 'low',
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
  renderer.shadowMap.enabled = Q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.getElementById('loader'));

  // Post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let fxaa = null;
  if (Q.bloom) {
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.55, 0.92
    ));
  }
  if (QUALITY !== 'low') {
    fxaa = new ShaderPass(FXAAShader);
    const pr = renderer.getPixelRatio();
    fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    composer.addPass(fxaa);
  }

  // Lights
  prog(15, 'placing sun');
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sunLight.position.set(40, 60, 30);
  if (Q.shadows) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.03;
  }
  scene.add(sunLight, sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xa8c8e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);
  scene.add(new THREE.AmbientLight(0xfff0d0, 0.18));

  // World
  prog(30, 'building world');
  const world = await createWorld(scene, sunLight, hemiLight, { Q, prog });

  // Player rig
  prog(55, 'waking farmer');
  const playerRig = createPlayer();
  scene.add(playerRig.root);
  playerRig.root.position.copy(gameState.player.position);
  playerRig.root.position.y = terrainHeight(playerRig.root.position.x, playerRig.root.position.z);
  gameState.player.position.copy(playerRig.root.position);
  window.__playerRig = playerRig;

  // Camera attached to scene (third-person rig — camera is separate, follows position)
  scene.add(camera);

  // Hands (tools attach to rig's toolAnchor)
  const handManager = new HandManager(camera, playerRig);
  window.__handManager = handManager;
  initDirtParticles(scene);

  // Plants
  const plantManager = new PlantManager(scene);
  window.__plantManager = plantManager;

  // Horse
  prog(62, 'saddling horse');
  let horseManager;
  try {
    horseManager = new HorseManager(scene, 6, -6);
    window.__horseManager = horseManager;
  } catch (e) {
    console.warn('Horse failed:', e);
    horseManager = { update(){}, handleInteract(){}, getInteractable(){ return null; }, horse: null };
  }

  // Collision
  world.buildCollision(Collision);

  // Input + HUD
  prog(70, 'wiring controls');
  wireKeyboard();
  wireMouse(renderer);
  wireTouch();
  HUD.init();
  HUD.refresh();

  // Expose globals for other modules
  window.__gameState = gameState;
  window.__HUD = HUD;
  window.__Audio = Audio;
  window.addEventListener('hud-refresh', () => HUD.refresh());

  // Pause buttons
  document.getElementById('pauseResume')?.addEventListener('click', togglePause);
  document.getElementById('pauseSave')?.addEventListener('click', () => {
    HUD.toast(Save.save() ? 'Game saved ✓' : 'Save failed');
  });
  document.getElementById('pauseMain')?.addEventListener('click', () => {
    gameState.paused = false;
    document.getElementById('pause')?.classList.remove('show');
    document.getElementById('hud')?.classList.remove('show');
    const menu = document.getElementById('menu');
    if (menu) { menu.style.display = 'flex'; menu.classList.remove('hide'); }
    gameState.started = false;
  });
  document.getElementById('musicVol')?.addEventListener('input', e => {
    Audio.setMusicVolume(parseFloat(e.target.value) / 100);
  });
  document.getElementById('sfxVol')?.addEventListener('input', e => {
    Audio.setSFXVolume(parseFloat(e.target.value) / 100);
  });
  document.getElementById('btnPause')?.addEventListener('click', e => {
    e.stopPropagation(); togglePause();
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    if (fxaa) {
      const pr = renderer.getPixelRatio();
      fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
  });

  // Save load
  const saved = Save.load();
  if (saved) { Save.apply(saved); HUD.refresh(); }

  // Menu
  prog(95, 'ready');
  const menu = document.getElementById('menu');
  const playBtn = document.getElementById('playBtn');
  document.getElementById('loader')?.classList.add('hide');
  if (menu) menu.style.display = 'flex';

  playBtn?.addEventListener('click', () => {
    Audio.init(); Audio.resume(); Audio.startMusic();
    menu?.classList.add('hide');
    document.getElementById('hud')?.classList.add('show');
    document.getElementById('touchControls')?.classList.add('show');
    gameState.started = true;
    if (!('ontouchstart' in window)) {
      setTimeout(() => renderer.domElement.requestPointerLock?.(), 400);
    }
    setTimeout(() => HUD.toast('Welcome to Verdant Vale 🌿', 3000), 600);
    setTimeout(() => HUD.toast('The horse is to your right →', 3000), 3800);
  });

  // Main loop
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 4.0;
  let hudAcc = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const elapsed = clock.elapsedTime;

    if (gameState.started && !gameState.paused) {
      // Mouse look
      if (Input.mouse.locked) {
        gameState.player.yaw -= Input.mouse.dx * SENS_DESKTOP;
        gameState.player.pitch -= Input.mouse.dy * SENS_DESKTOP;
      }
      if (Input.touchLook.dx || Input.touchLook.dy) {
        gameState.player.yaw -= Input.touchLook.dx * SENS_TOUCH;
        gameState.player.pitch -= Input.touchLook.dy * SENS_TOUCH;
      }
      gameState.player.pitch = clamp(gameState.player.pitch, -1.45, 1.45);

      // Day/night
      gameState.world.timeOfDay += dt / DAY_LENGTH;
      if (gameState.world.timeOfDay >= 1) {
        gameState.world.timeOfDay -= 1;
        gameState.world.day++;
        HUD.toast(`🌅 Day ${gameState.world.day}`, 3000);
      }

      // Movement
      if (gameState.horse.mounted && horseManager.horse) {
        horseManager.update(dt, elapsed, camera);
        gameState.player.yaw = horseManager.horse.rotation;
        gameState.player.eyeHeight = 2.3;
      } else {
        // Build anim state from input
        const animState = {
          movement: {
            w: !!(Input.keys['KeyW'] || Input.keys['ArrowUp']),
            s: !!(Input.keys['KeyS'] || Input.keys['ArrowDown']),
            a: !!(Input.keys['KeyA'] || Input.keys['ArrowLeft']),
            d: !!(Input.keys['KeyD'] || Input.keys['ArrowRight']),
            shift: !!(Input.keys['ShiftLeft'] || Input.keys['ShiftRight']),
          },
          cameraYaw: gameState.player.yaw,
          cameraPitch: gameState.player.pitch,
        };
        if (Input.touch.joystick.active) {
          const jx = Input.touch.joystick.x, jy = Input.touch.joystick.y;
          if (jy < -0.15) animState.movement.w = true;
          if (jy > 0.15) animState.movement.s = true;
          if (jx > 0.15) animState.movement.d = true;
          if (jx < -0.15) animState.movement.a = true;
          if (Math.hypot(jx, jy) > 0.85) animState.movement.shift = true;
        }

        updatePlayerAnimation(playerRig, animState, dt, terrainHeight, 200);

        // Collision after move
        const r = Collision.resolve(
          playerRig.root.position.x,
          playerRig.root.position.z,
          PLAYER_RADIUS
        );
        playerRig.root.position.x = r.x;
        playerRig.root.position.z = r.z;
        playerRig.root.position.y = terrainHeight(r.x, r.z);

        // Mirror to gameState (camera reads this)
        gameState.player.position.copy(playerRig.root.position);
        gameState.player.moveAmt = Math.hypot(playerRig.velocity.x, playerRig.velocity.z) / RUN_SPEED;
        gameState.player.runBlend = playerRig.anim.runBlend.value;
        gameState.player.eyeHeight = EYE_HEIGHT;

        // Head look
        playerRig.setLook(0, gameState.player.pitch);

        // Head bob for camera
        if (gameState.player.moveAmt > 0.1) {
          gameState.player.headBob += dt * (animState.movement.shift ? 12 : 8);
        }

        // Action swing
        if (Input.wantsPrimary) {
          playerRig.triggerToolSwing();
          Input.wantsPrimary = false;
        }

        // Jump
        if (Input.wantsJump && gameState.player.onGround) {
          gameState.player.velocity.y = JUMP_VELOCITY;
          gameState.player.onGround = false;
        }
        if (!gameState.player.onGround) {
          gameState.player.velocity.y -= GRAVITY * dt;
          playerRig.root.position.y += gameState.player.velocity.y * dt;
          gameState.player.position.y = playerRig.root.position.y;
          const groundY = terrainHeight(playerRig.root.position.x, playerRig.root.position.z);
          if (playerRig.root.position.y <= groundY) {
            playerRig.root.position.y = groundY;
            gameState.player.position.y = groundY;
            gameState.player.velocity.y = 0;
            gameState.player.onGround = true;
          }
        }

        // Update horse (still wanders even when not mounted)
        horseManager.update(dt, elapsed, camera);
      }
      applyCamera(camera);

      // World
      world.update(dt, elapsed, camera);
      world.updateTimeOfDay(gameState.world.timeOfDay, sunLight, hemiLight, camera, scene);

      // Dirt particles
      updateDirtParticles(dt);

      // Plants
      plantManager.update(dt);

      // Interaction
      const interactables = [
        ...(world.getInteractables?.() || []),
        ...(horseManager.getInteractable?.() ? [horseManager.getInteractable()] : []),
      ];

      if (Input.wantsInteract) {
        Input.wantsInteract = false;
        performAction(handManager, camera, plantManager, interactables);
      }

      // Prompt
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      raycaster.set(camera.position, dir);
      const plantMeshes = plantManager.getInteractableMeshes();
      const plantHits = plantMeshes.length ? raycaster.intersectObjects(plantMeshes, true) : [];
      const worldHits = interactables.length ? raycaster.intersectObjects(interactables, true) : [];

      let prompt = '';
      if (plantHits.length) {
        const p = plantManager.findPlantFromObject(plantHits[0].object);
        if (p) prompt = p.getPrompt();
      } else if (worldHits.length) {
        let o = worldHits[0].object;
        while (o && !o.userData.interact) o = o.parent;
        if (o?.userData?.interact) prompt = o.userData.interact.prompt;
      }
      HUD.setPrompt(prompt);

      // Clock
      hudAcc += dt;
      if (hudAcc > 0.4) {
        hudAcc = 0;
        HUD.clock(gameState.world.timeOfDay, gameState.world.day, gameState.world.weather);
      }
    } else if (!gameState.started) {
      const p = gameState.player;
      const t = elapsed * 0.08;
      camera.position.set(p.position.x + Math.sin(t) * 6, p.position.y + 2.5, p.position.z + Math.cos(t) * 6);
      camera.lookAt(p.position.x, p.position.y + 1.4, p.position.z);
    }

    Input.reset();
    composer.render();
  }

  animate();
  prog(100, 'ready');
}

boot().catch(err => {
  console.error('[engine] Boot failed:', err);
  const s = document.getElementById('loadStatus');
  if (s) s.textContent = 'error: ' + (err?.message || 'unknown').slice(0, 80);
  setTimeout(() => window.forceStart && window.forceStart(), 500);
});
