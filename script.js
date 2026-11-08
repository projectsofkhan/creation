import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import { createWorld } from './others.js';
import {
  createPlayer, updatePlayerAnimation, createCameraRig,
  createFarmGrid, attemptAction, createState, createHUD
} from './game.js';

// ── Constants ─────────────────────────────────────────────────
export const WORLD_SIZE = 80;
export const GRID_SIZE = 12;
export const CELL_SIZE = 5;
export const HALF_WORLD = WORLD_SIZE / 2;
export const HALF_GRID = (GRID_SIZE * CELL_SIZE) / 2;

export function terrainHeight(x, z) {
  const inGrid = Math.abs(x) < HALF_GRID + 5 && Math.abs(z) < HALF_GRID + 5;
  const falloff = inGrid ? Math.max(0, 1 - (Math.max(Math.abs(x), Math.abs(z)) - HALF_GRID) / 8) : 0;
  const base =
    Math.sin(x * 0.07) * Math.cos(z * 0.06) * 2.4 +
    Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.19 + 3.2) * 1.2 +
    Math.sin(x * 0.35 + 5.1) * Math.cos(z * 0.31 + 1.3) * 0.4;
  return base * (1 - falloff * 0.92);
}

// ── Progress hook ─────────────────────────────────────────────
const $bar = document.getElementById('barFill');
const $status = document.getElementById('loadStatus');
export function progress(pct, label) {
  if ($bar) $bar.style.width = pct + '%';
  if ($status && label) $status.textContent = label;
}

// ── Boot ──────────────────────────────────────────────────────
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

  // Small chromatic aberration on hits
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

  // World (lights, terrain, sky, trees, grass, pond, clouds)
  const world = await createWorld(scene, renderer, camera, { progress });

  progress(70, 'waking farmer');

  // Player rig
  const playerRig = createPlayer();
  scene.add(playerRig.root);
  playerRig.root.position.set(0, terrainHeight(0, HALF_GRID + 4), HALF_GRID + 4);

  // Farm grid
  const farm = createFarmGrid(scene, terrainHeight);
  scene.add(farm.group);

  // State + HUD
  const state = createState();
  const hud = createHUD(state);

  // Camera rig (tilted mobile view + orbit + follow)
  const camRig = createCameraRig(camera, playerRig.root, state, terrainHeight);
  camRig.snap();

  // Initial UI
  hud.update();
  hud.buildHotbar();

  progress(90, 'opening gate');

  // ── Menu → game transition ─────────────────────────────────
  const menu = document.getElementById('menu');
  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => {
    initAudio();
    playChime(660, 0.22, 'sine', 0.08);

    // little ripple
    const rip = document.createElement('div');
    const r = playBtn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    rip.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.6);width:${size}px;height:${size}px;left:${event.clientX - r.left - size / 2}px;top:${event.clientY - r.top - size / 2}px;transform:scale(0);animation:rippleOut 0.7s ease-out forwards;pointer-events:none;`;
    playBtn.appendChild(rip);
    setTimeout(() => rip.remove(), 700);

    menu.classList.add('hide');
    document.getElementById('hud').classList.add('show');
    state.started = true;
    if (!('ontouchstart' in window)) {
      setTimeout(() => renderer.domElement.requestPointerLock?.(), 500);
    }
    setTimeout(() => hud.toast('Welcome to Verdant Vale 🌿'), 800);
  });

  // ── Input wiring ───────────────────────────────────────────
  wireInput(renderer, state, hud, playerRig, farm, camRig, chromaPass);

  // ── Resize ─────────────────────────────────────────────────
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
    // Only show for very short landscape (typical phones in landscape)
    r.classList.toggle('show', innerWidth > innerHeight && innerHeight < 500);
  }
  checkOrientation();

  // ── Audio ──────────────────────────────────────────────────
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
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  }
  // expose for game.js
  window.__audio = { playChime, initAudio };

  // ── Main loop ──────────────────────────────────────────────
  const clock = new THREE.Clock();
  let elapsed = 0;
  const tmpFwd = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    elapsed += dt;

    // Chroma fade
    if (chromaPass.uniforms.amount.value > 0) {
      chromaPass.uniforms.amount.value = Math.max(0, chromaPass.uniforms.amount.value - dt * 3.5);
    }

    // Hit stop
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      composer.render();
      return;
    }

    // World time
    world.updateTime(dt, state.timeOfDay);

    if (state.started) {
      // Camera controls
      camRig.update(dt);

      // Player movement
      updatePlayerAnimation(playerRig, state, dt, terrainHeight);

      // Farm growth
      farm.update(dt, elapsed);

      // Crop sway (called from farm.update but let's also add here for safety)
      farm.sway(elapsed);
    } else {
      // Menu showcase
      state.timeOfDay = (state.timeOfDay + dt / state.dayLength) % 1;
      camRig.menuOrbit(dt, elapsed);
    }

    // Ensure sun sprite always faces camera
    world.sunMesh.lookAt(camera.position);

    composer.render();
  }

  // Add ripple keyframe once
  if (!document.getElementById('rippleStyle')) {
    const style = document.createElement('style');
    style.id = 'rippleStyle';
    style.textContent = `@keyframes rippleOut{to{transform:scale(4);opacity:0}}`;
    document.head.appendChild(style);
  }

  progress(100, 'ready');
  document.getElementById('loader').classList.add('hide');
  document.getElementById('menu').style.display = 'flex';

  animate();
}

// ── Input wiring (keyboard, mouse, touch) ────────────────────
function wireInput(renderer, state, hud, playerRig, farm, camRig, chromaPass) {
  // Keyboard
  addEventListener('keydown', e => {
    if (!state.started) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') state.movement.w = true;
    if (k === 'a' || k === 'arrowleft') state.movement.a = true;
    if (k === 's' || k === 'arrowdown') state.movement.s = true;
    if (k === 'd' || k === 'arrowright') state.movement.d = true;
    if (k === 'shift') state.movement.shift = true;
    if (k >= '1' && k <= '5') hud.selectTool(parseInt(k) - 1);
    if (k === 'e') hud.toggleShop();
    if (k === ' ') { e.preventDefault(); attemptAction(playerRig, state, farm, hud, chromaPass); }
  });
  addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') state.movement.w = false;
    if (k === 'a' || k === 'arrowleft') state.movement.a = false;
    if (k === 's' || k === 'arrowdown') state.movement.s = false;
    if (k === 'd' || k === 'arrowright') state.movement.d = false;
    if (k === 'shift') state.movement.shift = false;
  });

  // Mouse
  let pointerLocked = false;
  renderer.domElement.addEventListener('click', () => {
    if (!state.started) return;
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
    if (pointerLocked) {
      camRig.orbit(e.movementX, e.movementY);
    }
  });
  addEventListener('wheel', e => {
    camRig.zoom(e.deltaY);
  }, { passive: true });

  // Touch: drag to orbit, tap to act
  let touchStart = null;
  renderer.domElement.addEventListener('touchstart', e => {
    if (!state.started) return;
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), moved: false };
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchmove', e => {
    if (!state.started || !touchStart) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) touchStart.moved = true;
      camRig.orbit(dx * 2.4, dy * 2.4);
      touchStart.x = t.clientX;
      touchStart.y = t.clientY;
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchend', () => {
    if (touchStart && !touchStart.moved && Date.now() - touchStart.t < 260) {
      attemptAction(playerRig, state, farm, hud, chromaPass);
    }
    touchStart = null;
  });

  // HUD click-through
  document.getElementById('hotbar').addEventListener('click', e => e.stopPropagation());
  document.getElementById('shop').addEventListener('click', e => e.stopPropagation());
}

// ── Kick off ─────────────────────────────────────────────────
boot().catch(err => {
  console.error('[Boot error]', err);
  const s = document.getElementById('loadStatus');
  if (s) s.textContent = 'error: ' + (err?.message || String(err)).slice(0, 60);
});