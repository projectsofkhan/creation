import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { createWorld, formatClock, TOOL_DEFS, CROP_TYPES } from './others.js';
import {
  createPlayer, updatePlayerAnimation, createCameraRig,
  createFarmGrid, attemptAction, createState, createHUD,
  createAnimals, createDecorations, saveGame, loadGame,
} from './game.js';

// ═══════════════════════════════════════════════════════════════
//  VERDANT VALE — script.js  (main orchestrator)
// ═══════════════════════════════════════════════════════════════

// ── World constants ────────────────────────────────────────
const WORLD_SIZE = 80;
const GRID_SIZE = 12;
const CELL_SIZE = 5;
const HALF_WORLD = WORLD_SIZE / 2;
const HALF_GRID = (GRID_SIZE * CELL_SIZE) / 2;

function terrainHeight(x, z) {
  const inGrid = Math.abs(x) < HALF_GRID + 5 && Math.abs(z) < HALF_GRID + 5;
  const falloff = inGrid ? Math.max(0, 1 - (Math.max(Math.abs(x), Math.abs(z)) - HALF_GRID) / 8) : 0;
  const base =
    Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2.4 +
    Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.19 + 3.2) * 1.2 +
    Math.sin(x * 0.35 + 5.1) * Math.cos(z * 0.31 + 1.3) * 0.4;
  return base * (1 - falloff * 0.92);
}

// ── Progress ───────────────────────────────────────────────
const $bar = document.getElementById('barFill');
const $status = document.getElementById('loadStatus');
function progress(pct, label) {
  if ($bar) $bar.style.width = pct + '%';
  if ($status && label) $status.textContent = label;
}

// ── Boot ───────────────────────────────────────────────────
async function boot() {
  progress(8, 'creating renderer');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0xb8d8e8, 0.011);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 500);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
    alpha: false,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.getElementById('loader'));

  // Post-processing
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.28, 0.65, 0.92);
  composer.addPass(bloom);

  const fxaa = new ShaderPass(FXAAShader);
  const pr = renderer.getPixelRatio();
  fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
  composer.addPass(fxaa);

  const chromaPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, amount: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5; float d = length(c) * amount;
        vec2 dir = normalize(c + 0.0001);
        vec4 col;
        col.r = texture2D(tDiffuse, vUv + dir * d).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - dir * d).b;
        col.a = 1.0;
        gl_FragColor = col;
      }`,
  });
  composer.addPass(chromaPass);

  progress(20, 'building world');

  // ── World ──────────────────────────────────────────────
  const world = await createWorld(scene, renderer, camera, {
    progress,
    WORLD_SIZE, HALF_GRID, HALF_WORLD, terrainHeight,
  });

  progress(72, 'waking farmer');

  // ── Player ─────────────────────────────────────────────
  const playerRig = createPlayer();
  scene.add(playerRig.root);
  playerRig.root.position.set(0, terrainHeight(0, HALF_GRID + 4), HALF_GRID + 4);
  window.__playerRig = playerRig;

  // ── Farm ───────────────────────────────────────────────
  const farm = createFarmGrid(scene, terrainHeight, GRID_SIZE, CELL_SIZE, HALF_GRID);

  // ── Animals & decor ────────────────────────────────────
  const animals = createAnimals(scene, terrainHeight, HALF_GRID);
  const decorations = createDecorations(scene, terrainHeight, HALF_GRID);

  progress(82, 'loading save');

  // ── State & HUD ────────────────────────────────────────
  const state = createState();
  const hud = createHUD(state);

  // Try to load save
  const loaded = loadGame(state, farm);
  if (loaded) {
    hud.toast('Welcome back — save loaded 🌿');
    hud.feed('Save loaded');
  }

  hud.update();
  hud.buildHotbar();

  // ── Camera rig ─────────────────────────────────────────
  const camRig = createCameraRig(camera, playerRig.root, state, terrainHeight);
  camRig.snap();

  progress(92, 'opening gate');

  // ── Audio ──────────────────────────────────────────────
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playChime(freq = 440, dur = 0.4, type = 'sine', vol = 0.06) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }
  window.__audio = { playChime, initAudio };

  // ── Input wiring ───────────────────────────────────────
  wireKeyboard(state, hud, playerRig, farm, chromaPass, camRig);
  wireMouse(renderer, state, hud, playerRig, farm, chromaPass, camRig);
  wireTouch(renderer, state, hud, playerRig, farm, chromaPass, camRig);
  wireUIButtons(state, hud, camRig, farm);

  // ── Resize ─────────────────────────────────────────────
  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    const pr2 = renderer.getPixelRatio();
    fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr2), 1 / (innerHeight * pr2));
    checkOrientation();
  }
  addEventListener('resize', onResize);

  function checkOrientation() {
    const r = document.getElementById('rotate');
    if (!r) return;
    const portrait = innerHeight > innerWidth && innerWidth < 700;
    r.classList.toggle('show', portrait);
  }
  checkOrientation();

  // ── Menu → game ────────────────────────────────────────
  const menu = document.getElementById('menu');
  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => {
    initAudio();
    playChime(660, 0.22, 'sine', 0.08);

    const rip = document.createElement('div');
    const r = playBtn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    rip.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.6);width:${size}px;height:${size}px;left:${(event?.clientX || innerWidth / 2) - r.left - size / 2}px;top:${(event?.clientY || innerHeight / 2) - r.top - size / 2}px;transform:scale(0);animation:rippleOut 0.7s ease-out forwards;pointer-events:none;`;
    playBtn.appendChild(rip);
    setTimeout(() => rip.remove(), 700);

    menu.classList.add('hide');
    document.getElementById('hud').classList.add('show');
    state.started = true;

    if ('ontouchstart' in window) {
      document.getElementById('joystick').classList.add('show');
      document.getElementById('actionBtn').classList.add('show');
    } else {
      setTimeout(() => renderer.domElement.requestPointerLock?.(), 500);
    }

    setTimeout(() => hud.toast('Welcome to Verdant Vale 🌿'), 900);
    setTimeout(() => hud.feed('WASD to move · Click to act'), 1400);
  });

  // Add ripple keyframes once
  if (!document.getElementById('rippleStyle')) {
    const style = document.createElement('style');
    style.id = 'rippleStyle';
    style.textContent = '@keyframes rippleOut{to{transform:scale(4);opacity:0}}';
    document.head.appendChild(style);
  }

  // ── Day rollover tracking ──────────────────────────────
  let lastTimeOfDay = state.timeOfDay;

  // ── Main loop ──────────────────────────────────────────
  const clock = new THREE.Clock();
  let elapsed = 0;
  let hudTick = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    elapsed += dt;

    // Chroma fade
    if (chromaPass.uniforms.amount.value > 0) {
      chromaPass.uniforms.amount.value = Math.max(0, chromaPass.uniforms.amount.value - dt * 3.5);
    }

    // Pause handling
    if (state.paused) {
      composer.render();
      return;
    }

    // Hit stop
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      composer.render();
      return;
    }

    // World time update
    const tod = world.updateTime(dt, state.timeOfDay);
    state.timeOfDay = tod.t;

    // Day rollover
    if (lastTimeOfDay > 0.85 && state.timeOfDay < 0.15) {
      state.dayCount++;
      hud.update();
      hud.feed(`🌅 Day ${state.dayCount} begins`);
      playChime(520, 0.5, 'sine', 0.05);
    }
    lastTimeOfDay = state.timeOfDay;

    // Weather HUD update (throttled)
    hudTick += dt;
    if (hudTick > 0.5) {
      hudTick = 0;
      hud.updateClock(state.timeOfDay, tod.w);
    }

    // Menu orbit vs game
    if (state.started) {
      // Player movement — from keyboard, joystick, or touch
      applyJoystickToMovement(state);
      updatePlayerAnimation(playerRig, state, dt, terrainHeight, HALF_WORLD);
      camRig.update(dt);

      // Farm
      farm.update(dt, elapsed);
      farm.sway(elapsed);

      // Animals
      animals.update(dt, elapsed);

      // Lamp glow at night
      const night = tod.nightAmount;
      // (yard lamps not spawned yet — skip)

    } else {
      camRig.menuOrbit(dt, elapsed);
    }

    // World ambient animations
    world.update(dt);

    // Sun/moon face camera
    if (world.celestial?.sun) world.celestial.sun.lookAt(camera.position);
    if (world.celestial?.moon) world.celestial.moon.lookAt(camera.position);

    // Screen shake
    if (state.shakeTime > 0) {
      const sh = state.shakeTime * 0.08;
      camera.position.x += (Math.random() - 0.5) * sh;
      camera.position.y += (Math.random() - 0.5) * sh;
      state.shakeTime = Math.max(0, state.shakeTime - dt * 3.5);
    }

    composer.render();
  }

  progress(100, 'ready');
  document.getElementById('loader').classList.add('hide');
  menu.style.display = 'flex';

  animate();
}

// ═══════════════════════════════════════════════════════════════
//  INPUT — KEYBOARD
// ═══════════════════════════════════════════════════════════════
function wireKeyboard(state, hud, playerRig, farm, chromaPass, camRig) {
  addEventListener('keydown', e => {
    if (!state.started) return;

    const k = e.key.toLowerCase();

    if (k === 'w' || k === 'arrowup') state.movement.w = true;
    if (k === 'a' || k === 'arrowleft') state.movement.a = true;
    if (k === 's' || k === 'arrowdown') state.movement.s = true;
    if (k === 'd' || k === 'arrowright') state.movement.d = true;
    if (k === 'shift') state.movement.shift = true;

    if (k >= '1' && k <= '6') hud.selectTool(parseInt(k) - 1);
    if (k === 'e') hud.toggleShop();
    if (k === 'j') hud.toggleJournal();
    if (k === 'c') camRig.togglePreset();

    if (k === 'escape') {
      state.paused = !state.paused;
      document.getElementById('pause').classList.toggle('show', state.paused);
    }

    if (k === ' ') {
      e.preventDefault();
      if (!state.paused) attemptAction(playerRig, state, farm, hud, chromaPass);
    }

    if (k === 'f5') { /* prevent annoying reload */ }
  });

  addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') state.movement.w = false;
    if (k === 'a' || k === 'arrowleft') state.movement.a = false;
    if (k === 's' || k === 'arrowdown') state.movement.s = false;
    if (k === 'd' || k === 'arrowright') state.movement.d = false;
    if (k === 'shift') state.movement.shift = false;
  });
}

// ═══════════════════════════════════════════════════════════════
//  INPUT — MOUSE
// ═══════════════════════════════════════════════════════════════
function wireMouse(renderer, state, hud, playerRig, farm, chromaPass, camRig) {
  let pointerLocked = false;

  renderer.domElement.addEventListener('click', () => {
    if (!state.started || state.paused) return;
    if (!pointerLocked && !('ontouchstart' in window)) {
      renderer.domElement.requestPointerLock?.();
      return;
    }
    attemptAction(playerRig, state, farm, hud, chromaPass);
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });

  document.addEventListener('mousemove', e => {
    if (pointerLocked && state.started && !state.paused) {
      camRig.orbit(e.movementX, e.movementY);
    }
  });

  addEventListener('wheel', e => {
    if (state.started && !state.paused) camRig.zoom(e.deltaY);
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
//  INPUT — TOUCH (joystick + drag + tap to act)
// ═══════════════════════════════════════════════════════════════
function wireTouch(renderer, state, hud, playerRig, farm, chromaPass, camRig) {
  // Joystick
  const joystick = document.getElementById('joystick');
  const stick = joystick ? joystick.querySelector('.stick') : null;
  let joyId = null;
  let joyCenter = { x: 0, y: 0 };
  const JOY_MAX = 50;

  function onJoyStart(e) {
    if (!joystick) return;
    const t = e.changedTouches[0];
    const rect = joystick.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyId = t.identifier;
    e.preventDefault();
  }

  function onJoyMove(e) {
    if (joyId === null || !joystick) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === joyId) {
        let dx = t.clientX - joyCenter.x;
        let dy = t.clientY - joyCenter.y;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > JOY_MAX) { dx = (dx / mag) * JOY_MAX; dy = (dy / mag) * JOY_MAX; }
        if (stick) stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        state.joystick.active = true;
        state.joystick.dx = dx / JOY_MAX;
        state.joystick.dy = dy / JOY_MAX;
      }
    }
    e.preventDefault();
  }

  function onJoyEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyId) {
        joyId = null;
        state.joystick.active = false;
        state.joystick.dx = 0;
        state.joystick.dy = 0;
        if (stick) stick.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  if (joystick) {
    joystick.addEventListener('touchstart', onJoyStart, { passive: false });
    joystick.addEventListener('touchmove', onJoyMove, { passive: false });
    joystick.addEventListener('touchend', onJoyEnd);
    joystick.addEventListener('touchcancel', onJoyEnd);
  }

  // Action button
  const actionBtn = document.getElementById('actionBtn');
  if (actionBtn) {
    actionBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      if (state.started && !state.paused) {
        attemptAction(playerRig, state, farm, hud, chromaPass);
        if ('vibrate' in navigator) navigator.vibrate(15);
      }
    }, { passive: false });
    actionBtn.addEventListener('click', e => {
      e.stopPropagation();
    });
  }

  // Drag on canvas to orbit
  let touchStart = null;
  renderer.domElement.addEventListener('touchstart', e => {
    if (!state.started || state.paused) return;
    // Ignore if touching joystick/actionBtn area
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el && (el.closest('#joystick') || el.closest('#actionBtn') || el.closest('#hotbar') || el.closest('#shop'))) return;

    if (e.touches.length === 1) {
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
    }
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', e => {
    if (!state.started || state.paused || !touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) touchStart.moved = true;
    camRig.orbit(dx * 2.6, dy * 2.6);
    touchStart.x = t.clientX;
    touchStart.y = t.clientY;
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', () => {
    if (touchStart && !touchStart.moved && Date.now() - touchStart.t < 260) {
      attemptAction(playerRig, state, farm, hud, chromaPass);
    }
    touchStart = null;
  });
}

// ═══════════════════════════════════════════════════════════════
//  APPLY JOYSTICK
// ═══════════════════════════════════════════════════════════════
function applyJoystickToMovement(state) {
  if (!state.joystick.active) return;
  const dx = state.joystick.dx;
  const dy = state.joystick.dy;
  if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) return;

  // Forward = -y (up on joystick), right = +x
  state.movement.w = dy < -0.2;
  state.movement.s = dy > 0.2;
  state.movement.d = dx > 0.2;
  state.movement.a = dx < -0.2;
  state.movement.shift = Math.hypot(dx, dy) > 0.85;
}

// ═══════════════════════════════════════════════════════════════
//  UI BUTTONS
// ═══════════════════════════════════════════════════════════════
function wireUIButtons(state, hud, camRig, farm) {
  const btnJournal = document.getElementById('btnJournal');
  const btnShop = document.getElementById('btnShop');
  const btnPause = document.getElementById('btnPause');
  const btnCamera = document.getElementById('btnCamera');

  if (btnJournal) btnJournal.addEventListener('click', e => { e.stopPropagation(); hud.toggleJournal(); });
  if (btnShop) btnShop.addEventListener('click', e => { e.stopPropagation(); hud.toggleShop(); });
  if (btnCamera) btnCamera.addEventListener('click', e => { e.stopPropagation(); camRig.togglePreset(); });
  if (btnPause) {
    btnPause.addEventListener('click', e => {
      e.stopPropagation();
      state.paused = true;
      document.getElementById('pause').classList.add('show');
    });
  }

  document.getElementById('pauseResume').addEventListener('click', () => {
    state.paused = false;
    document.getElementById('pause').classList.remove('show');
  });

  document.getElementById('pauseSave').addEventListener('click', () => {
    const ok = saveGame(state, farm);
    hud.toast(ok ? 'Game saved ✓' : 'Save failed');
  });

  document.getElementById('pauseMain').addEventListener('click', () => {
    state.paused = false;
    document.getElementById('pause').classList.remove('show');
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('menu').classList.remove('hide');
    document.getElementById('hud').classList.remove('show');
    state.started = false;
  });

  // Prevent hotbar/shop clicks from bubbling to canvas
  document.getElementById('hotbar').addEventListener('click', e => e.stopPropagation());
  document.getElementById('shop').addEventListener('click', e => e.stopPropagation());
  document.getElementById('journal').addEventListener('click', e => e.stopPropagation());
}

// ═══════════════════════════════════════════════════════════════
//  KICK OFF
// ═══════════════════════════════════════════════════════════════
boot().catch(err => {
  console.error('[Boot error]', err);
  const s = document.getElementById('loadStatus');
  if (s) s.textContent = 'error: ' + (err?.message || String(err)).slice(0, 80);
  setTimeout(() => window.forceStart && window.forceStart(), 500);
});