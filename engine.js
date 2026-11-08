import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { createWorld } from './world.js';
import { PlantManager, CROPS } from './plants.js';
import {
  HandManager, performAction,
  initDirtParticles, updateDirtParticles,
  initWaterStream, updateWaterStream,
} from './tools.js';
import { HorseManager } from './horse.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — engine.js  (FULLY FIXED)
   ═══════════════════════════════════════════════════════════════ */

const $bar = document.getElementById('barFill');
const $status = document.getElementById('loadStatus');
function progress(pct, label) {
  if ($bar) $bar.style.width = pct + '%';
  if ($status && label) $status.textContent = label;
}

// ── Constants ───────────────────────────────────────────────
export const EYE_HEIGHT = 1.65;
export const WALK_SPEED = 3.2;
export const RUN_SPEED = 6.0;
export const JUMP_VELOCITY = 5.2;
export const GRAVITY = 18;

// ═══════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════
export const gameState = {
  player: {
    position: new THREE.Vector3(0, 0, 8),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    onGround: true,
    eyeHeight: EYE_HEIGHT,
    headBob: 0,
    moveAmt: 0,
    runBlend: 0,
    coins: 120,
    water: 15,
    waterMax: 15,
    harvest: 0,
    seeds: { tomato: 5, carrot: 3, potato: 2, corn: 0, lettuce: 0, strawberry: 0 },
    heldItem: 'hand',
    handsVisible: true,
  },
  world: {
    timeOfDay: 0.32,
    dayLength: 600,
    day: 1,
    weather: 'clear',
    weatherIntensity: 0,
  },
  camera: {
    baseFOV: 65,
    currentFOV: 65,
    shakeAmount: 0,
    shakeTime: 0,
  },
  paused: false,
  started: false,
  interaction: { target: null, prompt: '' },
  horse: { mounted: false, happy: 0.65 },
};

// ═══════════════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════════════
export const Input = {
  keys: Object.create(null),
  mouse: { dx: 0, dy: 0, buttons: Object.create(null), locked: false },
  touch: {
    joystick: { active: false, x: 0, y: 0 },
    look: { active: false, lastX: 0, lastY: 0, dx: 0, dy: 0 },
  },
  wantsPrimary: false,
  wantsJump: false,
  wantsInteract: false,

  reset() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.touch.look.dx = 0;
    this.touch.look.dy = 0;
    this.wantsPrimary = false;
    this.wantsJump = false;
    this.wantsInteract = false;
  },
};

// ═══════════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════════
export const Audio = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  musicPlaying: false,
  musicVolume: 0.4,
  sfxVolume: 0.6,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.5;
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume * 0.7;
      this.sfxGain.connect(this.masterGain);
    } catch (e) { console.warn('Audio init failed', e); }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  playTone(freq = 440, dur = 0.4, type = 'sine', vol = 0.08) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur);
  },

  playFootstep(run = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(run ? 90 : 70, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    gain.gain.setValueAtTime(run ? 0.12 : 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);
  },

  playWaterSplash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
  },

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;

    const progression = [
      [110.00, 164.81, 220.00, 277.18],
      [92.50, 138.59, 185.00, 220.00],
      [73.42, 110.00, 146.83, 185.00],
      [82.41, 123.47, 164.81, 207.65],
    ];
    let chordIdx = 0;

    const pad = () => {
      if (!this.musicPlaying) return;
      const t = this.ctx.currentTime;
      const chord = progression[chordIdx % progression.length];
      chordIdx++;

      for (const freq of chord) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.4;
        osc.type = 'sine';
        osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.002);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.025, t + 3);
        gain.gain.linearRampToValueAtTime(0.02, t + 6.5);
        gain.gain.linearRampToValueAtTime(0, t + 8);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 8.2);
      }
      setTimeout(pad, 8000);
    };
    pad();
  },

  stopMusic() { this.musicPlaying = false; },

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v * 0.5;
  },
  setSFXVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v * 0.7;
  },
};

// ═══════════════════════════════════════════════════════════════
//  SAVE / LOAD
// ═══════════════════════════════════════════════════════════════
export const Save = {
  KEY: 'verdant-vale-v3',
  save() {
    try {
      const p = gameState.player;
      const w = gameState.world;
      const data = {
        v: 3,
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
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  apply(data) {
    if (!data) return false;
    try {
      const p = gameState.player;
      const w = gameState.world;
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
        w.timeOfDay = data.world.timeOfDay ?? 0.32;
        w.day = data.world.day ?? 1;
        w.weather = data.world.weather ?? 'clear';
      }
      if (data.horse) {
        gameState.horse.happy = data.horse.happy ?? 0.65;
      }
      return true;
    } catch (e) { return false; }
  },
};

// ═══════════════════════════════════════════════════════════════
//  PLAYER CONTROLLER
// ═══════════════════════════════════════════════════════════════
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Use an object wrapper to prevent circular initialization errors
const terrainState = {
  fn: function(x, z) {
    return (
      Math.sin(x * 0.06) * Math.cos(z * 0.05) * 2.2 +
      Math.sin(x * 0.14 + 1.7) * Math.cos(z * 0.17 + 3.2) * 1.1
    );
  }
};

export function setTerrainHeightFn(fn) { terrainState.fn = fn; }
export function terrainHeight(x, z) { return terrainState.fn(x, z); }

function updatePlayerController(dt) {
  const p = gameState.player;
  const cam = gameState.camera;

  const LOOK_SENS_DESKTOP = 0.0022;
  const LOOK_SENS_TOUCH = 0.006;

  if (Input.mouse.locked) {
    p.yaw -= Input.mouse.dx * LOOK_SENS_DESKTOP;
    p.pitch -= Input.mouse.dy * LOOK_SENS_DESKTOP;
  }
  if (Input.touch.look.dx || Input.touch.look.dy) {
    p.yaw -= Input.touch.look.dx * LOOK_SENS_TOUCH;
    p.pitch -= Input.touch.look.dy * LOOK_SENS_TOUCH;
  }
  p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

  let forward = 0, strafe = 0, run = false;
  if (Input.keys['KeyW'] || Input.keys['ArrowUp']) forward += 1;
  if (Input.keys['KeyS'] || Input.keys['ArrowDown']) forward -= 1;
  if (Input.keys['KeyD'] || Input.keys['ArrowRight']) strafe += 1;
  if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) strafe -= 1;
  if (Input.keys['ShiftLeft'] || Input.keys['ShiftRight']) run = true;

  if (Input.touch.joystick.active) {
    const jx = Input.touch.joystick.x;
    const jy = Input.touch.joystick.y;
    if (Math.abs(jx) > 0.15) strafe += jx;
    if (Math.abs(jy) > 0.15) forward -= jy;
    if (Math.hypot(jx, jy) > 0.85) run = true;
  }

  const mag = Math.sqrt(forward * forward + strafe * strafe);
  if (mag > 1) { forward /= mag; strafe /= mag; }

  const sinY = Math.sin(p.yaw);
  const cosY = Math.cos(p.yaw);
  const dirX = -sinY * forward + cosY * strafe;
  const dirZ = -cosY * forward - sinY * strafe;

  const targetSpeed = run ? RUN_SPEED : WALK_SPEED;
  const accel = p.onGround ? 12 : 3;
  p.velocity.x = lerp(p.velocity.x, dirX * targetSpeed, 1 - Math.exp(-accel * dt));
  p.velocity.z = lerp(p.velocity.z, dirZ * targetSpeed, 1 - Math.exp(-accel * dt));

  if (Input.wantsJump && p.onGround) {
    p.velocity.y = JUMP_VELOCITY;
    p.onGround = false;
    Audio.playFootstep(true);
  }
  if (!p.onGround) p.velocity.y -= GRAVITY * dt;

  p.position.x += p.velocity.x * dt;
  p.position.z += p.velocity.z * dt;
  p.position.y += p.velocity.y * dt;

  const groundY = terrainHeight(p.position.x, p.position.z);
  if (p.position.y <= groundY) {
    p.position.y = groundY;
    p.velocity.y = 0;
    p.onGround = true;
  }

  const horizSpeed = Math.sqrt(p.velocity.x ** 2 + p.velocity.z ** 2);
  p.moveAmt = horizSpeed / RUN_SPEED;
  p.runBlend = lerp(p.runBlend, run ? 1 : 0, 1 - Math.exp(-6 * dt));

  if (p.onGround && horizSpeed > 0.4) {
    const bobSpeed = run ? 13 : 8.5;
    const prevBob = p.headBob;
    p.headBob += dt * bobSpeed;
    if (Math.floor(prevBob / Math.PI) !== Math.floor(p.headBob / Math.PI)) {
      Audio.playFootstep(run);
    }
  }

  const targetFOV = cam.baseFOV + (run && horizSpeed > 2 ? 4 : 0);
  cam.currentFOV = lerp(cam.currentFOV, targetFOV, 1 - Math.exp(-5 * dt));
}

function applyCamera(camera) {
  const p = gameState.player;
  const c = gameState.camera;

  const bobY = p.moveAmt > 0.05 && p.onGround
    ? Math.sin(p.headBob) * 0.045 * p.moveAmt : 0;
  const bobX = p.moveAmt > 0.05 && p.onGround
    ? Math.cos(p.headBob * 0.5) * 0.02 * p.moveAmt : 0;

  camera.position.set(
    p.position.x + bobX,
    p.position.y + p.eyeHeight + bobY,
    p.position.z
  );

  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.pitch);
  const q = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);

  if (c.shakeTime > 0) {
    c.shakeTime = Math.max(0, c.shakeTime - 1 / 60);
    const amt = c.shakeAmount * c.shakeTime;
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (Math.random() - 0.5) * amt,
      (Math.random() - 0.5) * amt,
      (Math.random() - 0.5) * amt
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
  crosshair: null, prompt: null, toast: null,
  coinVal: null, waterVal: null, waterBar: null, harvestVal: null,
  clockDisplay: null, dayDisplay: null, weatherDisplay: null,
  toastTimer: null,

  init() {
    this.crosshair = document.getElementById('crosshair');
    this.prompt = document.getElementById('prompt');
    this.toast = document.getElementById('toast');
    this.coinVal = document.getElementById('coinVal');
    this.waterVal = document.getElementById('waterVal');
    this.waterBar = document.getElementById('waterBar');
    this.harvestVal = document.getElementById('harvestVal');
    this.clockDisplay = document.getElementById('clockDisplay');
    this.dayDisplay = document.getElementById('dayDisplay');
    this.weatherDisplay = document.getElementById('weatherDisplay');
  },

  refresh() {
    const p = gameState.player;
    if (this.coinVal) this.coinVal.textContent = p.coins;
    if (this.waterVal) this.waterVal.textContent = p.water;
    if (this.waterBar) this.waterBar.style.width = (p.water / p.waterMax * 100) + '%';
    if (this.harvestVal) this.harvestVal.textContent = p.harvest;
  },

  setPrompt(html) {
    if (!this.prompt) return;
    if (html) {
      if (this.prompt._last !== html) {
        this.prompt.innerHTML = html;
        this.prompt._last = html;
      }
      this.prompt.classList.add('show');
    } else {
      this.prompt.classList.remove('show');
      this.prompt._last = null;
    }
  },

  showToast(text, duration = 2400) {
    if (!this.toast) return;
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), duration);
  },

  updateClock(timeOfDay, day, weather) {
    const totalMin = timeOfDay * 24 * 60;
    const h = Math.floor(totalMin / 60);
    const m = Math.floor(totalMin % 60);
    if (this.clockDisplay) this.clockDisplay.textContent =
      String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    if (this.dayDisplay) this.dayDisplay.textContent = 'Day ' + day;
    if (this.weatherDisplay) {
      const icons = { clear: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️', fog: '🌫️', snow: '❄️' };
      this.weatherDisplay.textContent = (icons[weather] || '☀️') + ' ' + weather;
    }
  },
};

window.__hudRef = HUD;
window.addEventListener('hud-refresh', () => HUD.refresh());

// ═══════════════════════════════════════════════════════════════
//  PAUSE
// ═══════════════════════════════════════════════════════════════
function togglePause() {
  gameState.paused = !gameState.paused;
  document.getElementById('pause').classList.toggle('show', gameState.paused);
  if (gameState.paused && document.pointerLockElement) document.exitPointerLock?.();
}

// ═══════════════════════════════════════════════════════════════
//  INPUT SETUP
// ═══════════════════════════════════════════════════════════════
function setupKeyboard() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    Input.keys[e.code] = true;

    if (e.code === 'Escape') {
      if (gameState.started) togglePause();
      return;
    }
    if (!gameState.started || gameState.paused) return;

    if (e.code === 'KeyE') { Input.wantsInteract = true; e.preventDefault(); }
    if (e.code === 'KeyF') { Input.wantsPrimary = true; }
    if (e.code === 'Space') { Input.wantsJump = true; e.preventDefault(); }
  });

  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in Input.keys) Input.keys[k] = false; });
}

function setupMouse(renderer) {
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

function setupTouch() {
  const joystick = document.getElementById('joystick');
  const stick = joystick?.querySelector('.stick');
  const lookPad = document.getElementById('lookPad');
  const btnPrimary = document.getElementById('btnPrimary');
  const btnJump = document.getElementById('btnJump');

  let joyId = null;
  let joyCenter = { x: 0, y: 0 };
  const JOY_MAX = 52;

  if (joystick) {
    joystick.addEventListener('touchstart', e => {
      if (!gameState.started || gameState.paused) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = joystick.getBoundingClientRect();
      joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joyId = t.identifier;
    }, { passive: false });

    joystick.addEventListener('touchmove', e => {
      if (joyId === null) return;
      e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === joyId) {
          let dx = t.clientX - joyCenter.x;
          let dy = t.clientY - joyCenter.y;
          const mag = Math.sqrt(dx * dx + dy * dy);
          if (mag > JOY_MAX) { dx = (dx / mag) * JOY_MAX; dy = (dy / mag) * JOY_MAX; }
          if (stick) stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          Input.touch.joystick.active = true;
          Input.touch.joystick.x = dx / JOY_MAX;
          Input.touch.joystick.y = dy / JOY_MAX;
        }
      }
    }, { passive: false });

    const endJoy = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
          joyId = null;
          Input.touch.joystick.active = false;
          Input.touch.joystick.x = 0;
          Input.touch.joystick.y = 0;
          if (stick) stick.style.transform = 'translate(-50%, -50%)';
        }
      }
    };
    joystick.addEventListener('touchend', endJoy);
    joystick.addEventListener('touchcancel', endJoy);
  }

  if (lookPad) {
    let lookId = null;
    lookPad.addEventListener('touchstart', e => {
      if (!gameState.started || gameState.paused) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      lookId = t.identifier;
      Input.touch.look.lastX = t.clientX;
      Input.touch.look.lastY = t.clientY;
      Input.touch.look.active = true;
    }, { passive: false });
    lookPad.addEventListener('touchmove', e => {
      if (lookId === null) return;
      e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === lookId) {
          Input.touch.look.dx += t.clientX - Input.touch.look.lastX;
          Input.touch.look.dy += t.clientY - Input.touch.look.lastY;
          Input.touch.look.lastX = t.clientX;
          Input.touch.look.lastY = t.clientY;
        }
      }
    }, { passive: false });
    const endLook = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookId) {
          lookId = null;
          Input.touch.look.active = false;
        }
      }
    };
    lookPad.addEventListener('touchend', endLook);
    lookPad.addEventListener('touchcancel', endLook);
  }

  if (btnPrimary) {
    btnPrimary.addEventListener('touchstart', e => {
      if (!gameState.started || gameState.paused) return;
      e.preventDefault();
      e.stopPropagation();
      Input.wantsInteract = true;
      Input.wantsPrimary = true;
      if ('vibrate' in navigator) navigator.vibrate(10);
    }, { passive: false });
  }
  if (btnJump) {
    btnJump.addEventListener('touchstart', e => {
      if (!gameState.started || gameState.paused) return;
      e.preventDefault();
      e.stopPropagation();
      Input.wantsJump = true;
    }, { passive: false });
  }
}

// ═══════════════════════════════════════════════════════════════
//  TOOL PICKUPS — on the shed wall
// ═══════════════════════════════════════════════════════════════
function addToolPickups(scene, shedX, shedZ) {
  const y = terrainHeight(shedX, shedZ);

  const tools = [
    { id: 'hoe', pos: [-1.5, 1.4, 2.0], name: 'Hoe', emoji: '⛏️' },
    { id: 'wateringcan', pos: [0, 1.4, 2.0], name: 'Watering Can', emoji: '💧' },
    { id: 'trowel', pos: [1.5, 1.4, 2.0], name: 'Trowel', emoji: '🔨' },
    { id: 'basket', pos: [2.8, 1.4, 2.0], name: 'Basket', emoji: '🧺' },
  ];

  const created = [];
  for (const t of tools) {
    const hook = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 })
    );
    hook.position.set(shedX + t.pos[0], y + t.pos[1] + 0.3, shedZ + t.pos[2]);
    hook.castShadow = true;
    hook.userData.interact = {
      type: 'take_tool',
      toolId: t.id,
      toolName: t.name,
      emoji: t.emoji,
      prompt: `<span class="key">E</span> Take ${t.emoji} ${t.name}`,
    };
    scene.add(hook);
    created.push(hook);
  }
  return created;
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════
async function boot() {
  progress(8, 'creating renderer');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0xb8d8e8, 0.008);

  const camera = new THREE.PerspectiveCamera(
    gameState.camera.baseFOV, window.innerWidth / window.innerHeight, 0.08, 500
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true, powerPreference: 'high-performance', stencil: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.getElementById('loader'));

  // ── Post ────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.22, 0.55, 0.92
  );
  composer.addPass(bloom);
  const fxaa = new ShaderPass(FXAAShader);
  const pr = renderer.getPixelRatio();
  fxaa.material.uniforms.resolution.value.set(
    1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr)
  );
  composer.addPass(fxaa);

  // ── Lights ───────────────────────────────────────
  progress(15, 'placing sun');
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sunLight.position.set(40, 60, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight, sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xa8c8e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);
  scene.add(new THREE.AmbientLight(0xfff0d0, 0.18));

  // ── World ────────────────────────────────────────
  progress(30, 'building world');
  let world;
  try {
    // FIXED: Pass setTerrainHeightFn safely
    world = await createWorld(scene, sunLight, hemiLight, setTerrainHeightFn);
  } catch (e) {
    console.error('[engine] World creation failed:', e);
    const fallbackGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
    fallbackGeo.rotateX(-Math.PI / 2);
    const fallbackMesh = new THREE.Mesh(
      fallbackGeo,
      new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.95 })
    );
    fallbackMesh.receiveShadow = true;
    scene.add(fallbackMesh);
    world = {
      update: () => {},
      updateTimeOfDay: () => {},
      getInteractables: () => [],
    };
    HUD.showToast('⚠️ World failed — using flat ground');
  }

  // ── Player start ─────────────────────────────────
  progress(60, 'waking up');
  gameState.player.position.y = terrainHeight(gameState.player.position.x, gameState.player.position.z);

  // ── Hands + tools ────────────────────────────────
  scene.add(camera);
  const handManager = new HandManager(camera);
  window.__handManager = handManager;
  initDirtParticles(scene);
  initWaterStream(scene);

  // ── Plants ───────────────────────────────────────
  const plantManager = new PlantManager(scene);
  window.__plantManager = plantManager;

  // ── Horse ────────────────────────────────────────
  let horseManager;
  try {
    horseManager = new HorseManager(scene, 18, -8);
    window.__horseManager = horseManager;
  } catch (e) {
    console.warn('Horse failed:', e);
    horseManager = {
      update: () => {},
      handleInteract: () => {},
      getInteractable: () => null,
      horse: null,
    };
  }

  // ── Tool pickups on shed wall ────────────────────
  const toolPickups = addToolPickups(scene, -18, -14);

  // ── Input ────────────────────────────────────────
  progress(70, 'wiring controls');
  setupKeyboard();
  setupMouse(renderer);
  setupTouch();
  HUD.init();
  HUD.refresh();

  // ── Pause + UI buttons ───────────────────────────
  document.getElementById('pauseResume')?.addEventListener('click', togglePause);
  document.getElementById('pauseSave')?.addEventListener('click', () => {
    HUD.showToast(Save.save() ? 'Game saved ✓' : 'Save failed');
  });
  document.getElementById('pauseMain')?.addEventListener('click', () => {
    gameState.paused = false;
    document.getElementById('pause').classList.remove('show');
    document.getElementById('hud').classList.remove('show');
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('menu').classList.remove('hide');
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
  document.getElementById('btnJournal')?.addEventListener('click', e => {
    e.stopPropagation();
    const s = gameState.player.seeds;
    const txt = Object.entries(s).filter(([k,v]) => v > 0).map(([k,v]) => `${CROPS[k]?.emoji || '🌱'}${v}`).join(' ');
    HUD.showToast(`Seeds: ${txt || 'none'} · Holding: ${gameState.player.heldItem}`);
  });
  document.getElementById('btnHelp')?.addEventListener('click', e => {
    e.stopPropagation();
    HUD.showToast('WASD move · E interact · Shift run · ESC pause');
  });

  // ── Resize ────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    const pr2 = renderer.getPixelRatio();
    fxaa.material.uniforms.resolution.value.set(
      1 / (window.innerWidth * pr2), 1 / (window.innerHeight * pr2)
    );
  });

  // ── Load save ────────────────────────────────────
  const saved = Save.load();
  if (saved) { Save.apply(saved); HUD.refresh(); }

  // ── Menu ─────────────────────────────────────────
  progress(95, 'ready');
  const menu = document.getElementById('menu');
  const playBtn = document.getElementById('playBtn');
  document.getElementById('loader').classList.add('hide');
  menu.style.display = 'flex';

  playBtn.addEventListener('click', () => {
    Audio.init();
    Audio.resume();
    Audio.startMusic();
    menu.classList.add('hide');
    document.getElementById('hud').classList.add('show');
    document.getElementById('touchControls').classList.add('show');
    gameState.started = true;
    if (!('ontouchstart' in window)) {
      setTimeout(() => renderer.domElement.requestPointerLock?.(), 400);
    }
    setTimeout(() => HUD.showToast('Welcome to Verdant Vale 🌿', 3000), 600);
  });

  // ── Main loop ─────────────────────────────────────
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.8;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);

    if (gameState.started && !gameState.paused) {
      // Time advance
      gameState.world.timeOfDay += dt / gameState.world.dayLength;
      if (gameState.world.timeOfDay >= 1) {
        gameState.world.timeOfDay -= 1;
        gameState.world.day++;
        HUD.showToast(`🌅 Day ${gameState.world.day}`, 3000);
      }

      // ── Player vs horse ───────────────────────
      if (gameState.horse.mounted && horseManager.horse) {
        horseManager.update(dt, clock.elapsedTime, camera);
        gameState.player.yaw = horseManager.horse.rotation;
        gameState.player.eyeHeight = 2.3;
      } else {
        updatePlayerController(dt);
        gameState.player.eyeHeight = EYE_HEIGHT;
        if (horseManager.horse) horseManager.update(dt, clock.elapsedTime, camera);
      }

      applyCamera(camera);

      // ── World tick ──────────────────────────
      try {
        world.update(dt, clock.elapsedTime, camera);
        world.updateTimeOfDay(gameState.world.timeOfDay, sunLight, hemiLight, camera);
      } catch (e) { /* silent */ }

      // ── Hands + tools ───────────────────────
      handManager.update(dt, clock.elapsedTime,
        gameState.player.moveAmt > 0.1,
        gameState.player.runBlend > 0.5);
      updateDirtParticles(dt);
      updateWaterStream(dt, camera,
        handManager.currentTool === 'wateringcan' && Input.wantsPrimary);

      // ── Plants ──────────────────────────────
      plantManager.update(dt);

      // ── Interaction ─────────────────────────
      const allInteractables = [];
      try {
        const worldInteractables = world.getInteractables ? world.getInteractables() : [];
        if (Array.isArray(worldInteractables)) allInteractables.push(...worldInteractables);
      } catch (e) {}
      if (horseManager.getInteractable && horseManager.getInteractable()) {
        allInteractables.push(horseManager.getInteractable());
      }
      allInteractables.push(...toolPickups);

      if (Input.wantsInteract) {
        Input.wantsInteract = false;
        performAction(handManager, camera, plantManager, allInteractables);
      }

      // ── Prompt raycast ──────────────────────
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      raycaster.set(camera.position, dir);

      const plantMeshes = plantManager.getInteractableMeshes();
      const plantHits = plantMeshes.length > 0
        ? raycaster.intersectObjects(plantMeshes, true) : [];
      const worldHits = allInteractables.length > 0
        ? raycaster.intersectObjects(allInteractables, true) : [];

      let promptText = '';
      if (plantHits.length > 0) {
        const plant = plantManager.findPlantFromObject(plantHits[0].object);
        if (plant) promptText = plant.getPrompt();
      } else if (worldHits.length > 0) {
        let obj = worldHits[0].object;
        while (obj && !obj.userData.interact) obj = obj.parent;
        if (obj?.userData?.interact) promptText = obj.userData.interact.prompt;
      }
      HUD.setPrompt(promptText);

      // ── HUD clock (throttled) ───────────────
      if (!animate._acc) animate._acc = 0;
      animate._acc += dt;
      if (animate._acc > 0.4) {
        animate._acc = 0;
        HUD.updateClock(gameState.world.timeOfDay, gameState.world.day, gameState.world.weather);
      }
    } else if (!gameState.started) {
      // Menu showcase camera
      const p = gameState.player;
      const t = clock.elapsedTime * 0.08;
      camera.position.set(
        p.position.x + Math.sin(t) * 6,
        p.position.y + 2.5,
        p.position.z + Math.cos(t) * 6
      );
      camera.lookAt(p.position.x, p.position.y + 1.4, p.position.z);
    }

    Input.reset();
    composer.render();
  }

  animate();
  progress(100, 'ready');
}

boot().catch(err => {
  console.error('[engine] Boot failed:', err);
  const s = document.getElementById('loadStatus');
  if (s) s.textContent = 'error: ' + (err?.message || 'unknown').slice(0, 80);
  setTimeout(() => window.forceStart && window.forceStart(), 500);
});