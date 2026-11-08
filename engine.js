import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — engine.js
   First-person controller · input · audio · save · main loop
   ═══════════════════════════════════════════════════════════════ */

// ── Progress ────────────────────────────────────────────────
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
const CHUNK_SIZE = 40;
const CHUNK_VIEW_RADIUS = 3;

// ═══════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════
export const gameState = {
  // Player
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
    // Inventory
    coins: 120,
    water: 15,
    waterMax: 15,
    harvest: 0,
    seeds: { tomato: 5, carrot: 3, potato: 2, corn: 0, lettuce: 0, strawberry: 0 },
    // What we're holding
    heldItem: 'hand',  // 'hand', 'hoe', 'wateringcan', 'trowel', 'basket', 'seed_tomato', etc.
    handsVisible: true,
  },
  // World
  world: {
    timeOfDay: 0.32,       // 0 = midnight, 0.5 = noon
    dayLength: 600,        // 10 minutes per day (calm pace)
    day: 1,
    weather: 'clear',
    weatherIntensity: 0,
  },
  // Camera
  camera: {
    yawSpring: 0,
    pitchSpring: 0,
    baseFOV: 65,
    currentFOV: 65,
    shakeAmount: 0,
    shakeTime: 0,
  },
  // Meta
  paused: false,
  started: false,
  // Interaction
  interaction: {
    target: null,
    prompt: '',
  },
  // Horse
  horse: {
    mounted: false,
    happy: 0.7,
    position: null,  // set by horse.js
  },
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
    primary: false,
    jump: false,
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

function setupKeyboard() {
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    Input.keys[e.code] = true;

    if (e.code === 'Escape') {
      if (gameState.started) togglePause();
      return;
    }

    if (!gameState.started || gameState.paused) return;

    if (e.code === 'KeyE' || e.code === 'Space') {
      if (e.code === 'Space' && !Input.mouse.locked) return;
      Input.wantsInteract = true;
      Input.wantsPrimary = true;
      e.preventDefault();
    }
    if (e.code === 'KeyF') Input.wantsPrimary = true;
    if (e.code === 'Space') Input.wantsJump = true;
  });

  window.addEventListener('keyup', e => {
    Input.keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in Input.keys) Input.keys[k] = false;
  });
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

  renderer.domElement.addEventListener('mousedown', e => {
    Input.mouse.buttons[e.button] = true;
    if (e.button === 0 && Input.mouse.locked) Input.wantsPrimary = true;
    if (e.button === 2) e.preventDefault();
  });
  renderer.domElement.addEventListener('mouseup', e => {
    Input.mouse.buttons[e.button] = false;
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
          if (mag > JOY_MAX) {
            dx = (dx / mag) * JOY_MAX;
            dy = (dy / mag) * JOY_MAX;
          }
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
          const dx = t.clientX - Input.touch.look.lastX;
          const dy = t.clientY - Input.touch.look.lastY;
          Input.touch.look.dx += dx;
          Input.touch.look.dy += dy;
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
      Input.wantsPrimary = true;
      Input.wantsInteract = true;
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
//  AUDIO ENGINE — procedural ambient music + SFX
// ═══════════════════════════════════════════════════════════════
export const Audio = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  musicNodes: [],
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
    } catch (e) {
      console.warn('Audio init failed', e);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Simple synthesized chime — used by world events
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

  // Footstep thud
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

  // Water splash — soft
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

  // Ambient music — generative, calm
  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;

    // Chord pads (Amaj7 -> F#m7 -> Dmaj7 -> E) evolving slowly
    const progression = [
      [110.00, 164.81, 220.00, 277.18],  // A
      [92.50, 138.59, 185.00, 220.00],   // F#m
      [73.42, 110.00, 146.83, 185.00],   // D
      [82.41, 123.47, 164.81, 207.65],   // E
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

      // occasional high sparkle
      if (Math.random() < 0.5) {
        setTimeout(() => {
          if (!this.musicPlaying) return;
          const t2 = this.ctx.currentTime;
          const freq = chord[Math.floor(Math.random() * chord.length)] * 4;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t2);
          gain.gain.linearRampToValueAtTime(0.015, t2 + 0.5);
          gain.gain.exponentialRampToValueAtTime(0.001, t2 + 2.5);
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start(t2);
          osc.stop(t2 + 2.6);
        }, 4000 + Math.random() * 3000);
      }

      setTimeout(pad, 8000);
    };
    pad();
  },

  stopMusic() {
    this.musicPlaying = false;
  },

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
  KEY: 'verdant-vale-v2',

  save(extra = {}) {
    try {
      const p = gameState.player;
      const w = gameState.world;
      const data = {
        v: 2,
        player: {
          position: [p.position.x, p.position.y, p.position.z],
          yaw: p.yaw,
          pitch: p.pitch,
          coins: p.coins,
          water: p.water,
          harvest: p.harvest,
          seeds: { ...p.seeds },
          heldItem: p.heldItem,
        },
        world: {
          timeOfDay: w.timeOfDay,
          day: w.day,
          weather: w.weather,
        },
        extra,
        savedAt: Date.now(),
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
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
      return true;
    } catch (e) {
      return false;
    }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  },
};

// ═══════════════════════════════════════════════════════════════
//  FIRST-PERSON CONTROLLER
// ═══════════════════════════════════════════════════════════════
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

export function updatePlayerController(dt, terrainHeightFn) {
  const p = gameState.player;
  const c = gameState.camera;
  const cam = gameState.camera; // alias

  // ── LOOK ─────────────────────────────────────────────
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

  // clamp pitch
  p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

  // ── MOVEMENT ─────────────────────────────────────────
  let forward = 0;
  let strafe = 0;
  let run = false;

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

  // Normalize the (forward, strafe) vector so diagonal isn't faster
  const mag = Math.sqrt(forward * forward + strafe * strafe);
  if (mag > 1) {
    forward /= mag;
    strafe /= mag;
  }

  // Build direction from yaw
  const sinY = Math.sin(p.yaw);
  const cosY = Math.cos(p.yaw);

  // Forward in world = (-sin(yaw), 0, -cos(yaw)) [standard Three.js convention]
  const dirX = -sinY * forward + cosY * strafe;
  const dirZ = -cosY * forward - sinY * strafe;

  // Target speed
  const targetSpeed = run ? RUN_SPEED : WALK_SPEED;
  const targetVX = dirX * targetSpeed;
  const targetVZ = dirZ * targetSpeed;

  // Smooth acceleration (feels floaty but grounded)
  const accel = p.onGround ? 12 : 3;
  p.velocity.x = lerp(p.velocity.x, targetVX, 1 - Math.exp(-accel * dt));
  p.velocity.z = lerp(p.velocity.z, targetVZ, 1 - Math.exp(-accel * dt));

  // Jumping / gravity
  if (Input.wantsJump && p.onGround) {
    p.velocity.y = JUMP_VELOCITY;
    p.onGround = false;
    Audio.playFootstep(true);
  }
  if (!p.onGround) {
    p.velocity.y -= GRAVITY * dt;
  }

  // ── MOVE ─────────────────────────────────────────────
  p.position.x += p.velocity.x * dt;
  p.position.z += p.velocity.z * dt;
  p.position.y += p.velocity.y * dt;

  // Ground collision
  const groundY = terrainHeightFn(p.position.x, p.position.z);
  if (p.position.y <= groundY) {
    p.position.y = groundY;
    p.velocity.y = 0;
    p.onGround = true;
  }

  // ── HEAD BOB & SPEED FEEDBACK ────────────────────────
  const horizSpeed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);
  p.moveAmt = horizSpeed / RUN_SPEED;
  p.runBlend = lerp(p.runBlend, run ? 1 : 0, 1 - Math.exp(-6 * dt));

  if (p.onGround && horizSpeed > 0.4) {
    const bobSpeed = run ? 13 : 8.5;
    const prevBob = p.headBob;
    p.headBob += dt * bobSpeed;
    // footstep trigger at sin crossings
    if (Math.floor(prevBob / Math.PI) !== Math.floor(p.headBob / Math.PI)) {
      Audio.playFootstep(run);
    }
  } else {
    // slow settle
    const phase = p.headBob % Math.PI;
    p.headBob += dt * 3 * (phase < Math.PI / 2 ? 1 : -1) * 0.3;
  }

  // FOV effect when running
  const targetFOV = cam.baseFOV + (run && horizSpeed > 2 ? 4 : 0);
  cam.currentFOV = lerp(cam.currentFOV, targetFOV, 1 - Math.exp(-5 * dt));
}

// Apply camera transform (called after player update)
export function applyCamera(camera) {
  const p = gameState.player;
  const c = gameState.camera;

  // head bob offset
  const bobY = p.moveAmt > 0.05 && p.onGround
    ? Math.sin(p.headBob) * 0.045 * p.moveAmt
    : 0;
  const bobX = p.moveAmt > 0.05 && p.onGround
    ? Math.cos(p.headBob * 0.5) * 0.02 * p.moveAmt
    : 0;

  // Camera position = player eye
  camera.position.set(
    p.position.x + bobX,
    p.position.y + p.eyeHeight + bobY,
    p.position.z
  );

  // Build quaternion from yaw/pitch
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p.pitch);
  q.multiplyQuaternions(qYaw, qPitch);

  // Subtle camera shake
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

  // FOV
  if (Math.abs(camera.fov - c.currentFOV) > 0.01) {
    camera.fov = c.currentFOV;
    camera.updateProjectionMatrix();
  }
}

// Camera shake helper
export function shakeCamera(amount = 0.02, time = 0.3) {
  gameState.camera.shakeAmount = amount;
  gameState.camera.shakeTime = time;
}

// ═══════════════════════════════════════════════════════════════
//  TERRAIN HEIGHT FUNCTION (placeholder — world.js overrides)
// ═══════════════════════════════════════════════════════════════
export let terrainHeight = function(x, z) {
  // Gentle rolling hills — world.js will replace this with chunked terrain
  return (
    Math.sin(x * 0.06) * Math.cos(z * 0.05) * 2.2 +
    Math.sin(x * 0.14 + 1.7) * Math.cos(z * 0.17 + 3.2) * 1.1 +
    Math.sin(x * 0.3 + 5.1) * Math.cos(z * 0.28 + 1.3) * 0.35
  );
};

export function setTerrainHeightFn(fn) {
  terrainHeight = fn;
}

// ═══════════════════════════════════════════════════════════════
//  POST-PROCESSING
// ═══════════════════════════════════════════════════════════════
function createComposer(renderer, scene, camera) {
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
    1 / (window.innerWidth * pr),
    1 / (window.innerHeight * pr)
  );
  composer.addPass(fxaa);

  return { composer, bloom, fxaa };
}

// ═══════════════════════════════════════════════════════════════
//  HUD REFS (populated once HUD is visible)
// ═══════════════════════════════════════════════════════════════
const HUD = {
  crosshair: null,
  prompt: null,
  toast: null,
  coinVal: null,
  waterVal: null,
  waterBar: null,
  harvestVal: null,
  clockDisplay: null,
  dayDisplay: null,
  weatherDisplay: null,
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

  setPrompt(text) {
    if (!this.prompt) return;
    if (text) {
      this.prompt.innerHTML = text;
      this.prompt.classList.add('show');
    } else {
      this.prompt.classList.remove('show');
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
    const timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    if (this.clockDisplay) this.clockDisplay.textContent = timeStr;
    if (this.dayDisplay) this.dayDisplay.textContent = 'Day ' + day;
    if (this.weatherDisplay) {
      const icons = { clear: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️', fog: '🌫️', snow: '❄️' };
      this.weatherDisplay.textContent = (icons[weather] || '☀️') + ' ' + weather;
    }
  },

  pulsePill() {
    if (!this.crosshair) return;
    this.crosshair.classList.add('active');
    setTimeout(() => this.crosshair.classList.remove('active'), 250);
  },
};

export { HUD };

// ═══════════════════════════════════════════════════════════════
//  PAUSE
// ═══════════════════════════════════════════════════════════════
export function togglePause() {
  gameState.paused = !gameState.paused;
  const pauseEl = document.getElementById('pause');
  if (pauseEl) pauseEl.classList.toggle('show', gameState.paused);

  if (gameState.paused) {
    if (document.pointerLockElement) document.exitPointerLock?.();
  } else {
    if (!('ontouchstart' in window)) {
      // user must click to re-lock
    }
  }
}

function setupPauseButtons() {
  const resume = document.getElementById('pauseResume');
  const save = document.getElementById('pauseSave');
  const main = document.getElementById('pauseMain');
  const musicVol = document.getElementById('musicVol');
  const sfxVol = document.getElementById('sfxVol');

  if (resume) resume.addEventListener('click', () => togglePause());
  if (save) save.addEventListener('click', () => {
    const ok = Save.save();
    HUD.showToast(ok ? 'Game saved ✓' : 'Save failed');
  });
  if (main) main.addEventListener('click', () => {
    gameState.paused = false;
    document.getElementById('pause').classList.remove('show');
    document.getElementById('hud').classList.remove('show');
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('menu').classList.remove('hide');
    gameState.started = false;
  });
  if (musicVol) musicVol.addEventListener('input', e => {
    Audio.setMusicVolume(parseFloat(e.target.value) / 100);
  });
  if (sfxVol) sfxVol.addEventListener('input', e => {
    Audio.setSFXVolume(parseFloat(e.target.value) / 100);
  });
}

// ═══════════════════════════════════════════════════════════════
//  INTERACTION TARGETING (raycast from camera center)
// ═══════════════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
raycaster.far = 3.5; // 3.5 meters reach

export function findInteractionTarget(camera, interactables) {
  if (!interactables || interactables.length === 0) return null;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, dir);
  raycaster.far = 3.5;
  const hits = raycaster.intersectObjects(interactables, true);
  if (hits.length > 0) {
    // walk up until we find an object with userData.interact
    let obj = hits[0].object;
    while (obj && !obj.userData.interact) obj = obj.parent;
    return obj;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  BOOT — MAIN ENTRY
// ═══════════════════════════════════════════════════════════════
async function boot() {
  progress(8, 'creating renderer');

  // ── Renderer ──────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0xb8d8e8, 0.008);

  const camera = new THREE.PerspectiveCamera(
    gameState.camera.baseFOV,
    window.innerWidth / window.innerHeight,
    0.08, 500
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.getElementById('loader'));

  // ── Post ──────────────────────────────────────────────────
  const { composer } = createComposer(renderer, scene, camera);

  // ── Basic lighting (world.js will enhance) ───────────────
  progress(15, 'placing sun');
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sunLight.position.set(40, 60, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight, sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xa8c8e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);
  scene.add(new THREE.AmbientLight(0xfff0d0, 0.18));

  // ── Base terrain (placeholder — world.js will replace) ────
  progress(30, 'shaping the land');
  const terrainGeo = new THREE.PlaneGeometry(200, 200, 100, 100);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i), z = tPos.getZ(i);
    tPos.setY(i, terrainHeight(x, z));
  }
  terrainGeo.computeVertexNormals();
  const tCols = new Float32Array(tPos.count * 3);
  for (let i = 0; i < tPos.count; i++) {
    const n = Math.random() * 0.15;
    tCols[i * 3] = 0.28 + n * 0.3;
    tCols[i * 3 + 1] = 0.48 + n * 0.3;
    tCols[i * 3 + 2] = 0.20 + n * 0.15;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
  );
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // ── Placeholder tree so world isn't empty ───────────────
  progress(45, 'planting a tree');
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 12 + Math.random() * 30;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = terrainHeight(x, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.95 })
    );
    trunk.position.set(x, y + 1.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 2.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.9, flatShading: true })
    );
    leaf.position.set(x, y + 3.6, z);
    leaf.castShadow = true;
    scene.add(leaf);
  }

  // ── Player start position ─────────────────────────────────
  progress(60, 'waking up');
  const p = gameState.player;
  p.position.y = terrainHeight(p.position.x, p.position.z);

  // ── Input setup ───────────────────────────────────────────
  progress(70, 'wiring controls');
  setupKeyboard();
  setupMouse(renderer);
  setupTouch();
  setupPauseButtons();
  HUD.init();
  HUD.refresh();

  // ── Music toggle ──────────────────────────────────────────
  const musicToggle = document.getElementById('musicToggle');
  if (musicToggle) {
    musicToggle.style.display = 'flex';
    let musicOn = true;
    musicToggle.addEventListener('click', e => {
      e.stopPropagation();
      musicOn = !musicOn;
      if (musicOn) {
        Audio.startMusic();
        musicToggle.textContent = '🎵';
      } else {
        Audio.stopMusic();
        musicToggle.textContent = '🔇';
      }
    });
  }

  // ── Top buttons ───────────────────────────────────────────
  document.getElementById('btnPause')?.addEventListener('click', e => {
    e.stopPropagation();
    togglePause();
  });
  document.getElementById('btnJournal')?.addEventListener('click', e => {
    e.stopPropagation();
    HUD.showToast('Journal coming in Drop 2');
  });
  document.getElementById('btnHelp')?.addEventListener('click', e => {
    e.stopPropagation();
    HUD.showToast('WASD move · E interact · ESC pause');
  });

  // ── Resize ────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    const pr = renderer.getPixelRatio();
    composer.passes.forEach(pass => {
      if (pass.material?.uniforms?.resolution) {
        pass.material.uniforms.resolution.value.set(
          1 / (window.innerWidth * pr),
          1 / (window.innerHeight * pr)
        );
      }
    });
  });

  // ── Load save if exists ───────────────────────────────────
  const saved = Save.load();
  if (saved) {
    Save.apply(saved);
    HUD.refresh();
    progress(85, 'found a saved garden');
  }

  // ── Menu wiring ───────────────────────────────────────────
  const menu = document.getElementById('menu');
  const playBtn = document.getElementById('playBtn');
  menu.style.display = 'flex';
  document.getElementById('loader').classList.add('hide');

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
    setTimeout(() => HUD.showToast('Explore the farm — Drop 2 adds the house, horse, and plants', 4000), 4000);
  });

  // ── Main loop ─────────────────────────────────────────────
  progress(95, 'starting the clock');
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 1 / 30);

    // Consume input
    if (gameState.started && !gameState.paused) {
      // Advance world time
      gameState.world.timeOfDay += dt / gameState.world.dayLength;
      if (gameState.world.timeOfDay >= 1) {
        gameState.world.timeOfDay -= 1;
        gameState.world.day++;
        HUD.showToast(`🌅 Day ${gameState.world.day}`, 3000);
      }

      // Update player
      updatePlayerController(dt, terrainHeight);
      applyCamera(camera);

      // Sun follows time
      const tod = gameState.world.timeOfDay;
      const sunAngle = (tod - 0.25) * Math.PI * 2;
      sunLight.position.set(
        Math.cos(sunAngle) * 80,
        Math.max(4, Math.sin(sunAngle) * 70),
        Math.sin(sunAngle * 0.5) * 20
      );
      sunLight.target.position.set(p.position.x, 0, p.position.z);
      sunLight.target.updateMatrixWorld();

      // Sun intensity by time
      const dayness = Math.max(0, Math.min(1, 1 - Math.abs(tod - 0.5) * 3));
      sunLight.intensity = 0.15 + dayness * 1.6;
      hemiLight.intensity = 0.3 + dayness * 0.85;
      scene.fog.color.setHSL(0.55, 0.3, 0.4 + dayness * 0.4);
      scene.background.copy(scene.fog.color);

      // Update HUD clock (throttled)
      if (!animate._clockAcc) animate._clockAcc = 0;
      animate._clockAcc += dt;
      if (animate._clockAcc > 0.4) {
        animate._clockAcc = 0;
        HUD.updateClock(gameState.world.timeOfDay, gameState.world.day, gameState.world.weather);
      }

      // Update interaction prompt (throttled)
      if (!animate._interactAcc) animate._interactAcc = 0;
      animate._interactAcc += dt;
      if (animate._interactAcc > 0.1) {
        animate._interactAcc = 0;
        // (world.js will provide interactables — for now empty)
        gameState.interaction.target = null;
        gameState.interaction.prompt = '';
        HUD.setPrompt('');
      }
    } else if (gameState.started && gameState.paused) {
      // paused — do nothing
    } else {
      // menu — slowly orbit camera around player (nice background)
      const t = clock.elapsedTime * 0.08;
      camera.position.set(
        p.position.x + Math.sin(t) * 6,
        p.position.y + 2.5,
        p.position.z + Math.cos(t) * 6
      );
      camera.lookAt(p.position.x, p.position.y + 1.4, p.position.z);
    }

    // Reset mouse/look delta after consumption
    Input.reset();

    composer.render();
  }

  animate();
  progress(100, 'ready');
}

// ═══════════════════════════════════════════════════════════════
//  GO
// ═══════════════════════════════════════════════════════════════
boot().catch(err => {
  console.error('[engine] Boot failed:', err);
  const s = document.getElementById('loadStatus');
  if (s) s.textContent = 'error: ' + (err?.message || 'unknown').slice(0, 80);
  setTimeout(() => window.forceStart && window.forceStart(), 500);
});