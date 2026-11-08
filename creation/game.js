import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import {
  WORLD_SIZE, GRID_SIZE, CELL, HALF_WORLD, HALF_GRID,
  terrainHeight,
  buildSky, buildStars, buildSunDisc, buildClouds, buildTerrain,
  buildFarmGrid, buildVegetation, buildPond,
  buildPollen, buildFireflies, buildBirds,
  cropStageOf, updateCropMesh,
} from './world.js';

import { buildPlayer, createAnimator } from './player.js';

export async function initGame({ progress }) {
  progress(20, 'creating scene');

  // ── Scene / renderer ──
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c8e8);
  scene.fog = new THREE.FogExp2(0xa8d8e8, 0.012);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.getElementById('loader'));

  // ── Post-processing ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.7, 0.9);
  composer.addPass(bloom);
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

  progress(30, 'adding light');

  // ── Lights ──
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sunLight.position.set(20, 40, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 140;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.02;
  sunLight.shadow.autoUpdate = false;
  scene.add(sunLight, sunLight.target);
  const hemiLight = new THREE.HemisphereLight(0x9ec9e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);
  scene.add(new THREE.AmbientLight(0xfff0d0, 0.22));

  progress(40, 'building sky');

  // ── Sky ──
  const skyMat = buildSky(scene);
  const starMat = buildStars(scene);
  const sunMesh = buildSunDisc(scene);
  const clouds = buildClouds(scene);

  progress(50, 'shaping terrain');
  buildTerrain(scene);

  progress(58, 'planting crops');
  const { farmCells, group: plotsGroup, materials: soilMats } = buildFarmGrid(scene);
  const { matGrass, matTilled, matWet } = soilMats;

  progress(66, 'growing trees');
  const veg = buildVegetation(scene);

  progress(74, 'filling pond');
  const pond = buildPond(scene);

  progress(82, 'waking farmer');
  const { player, rig, updateHeldTool } = buildPlayer(scene);
  const animator = createAnimator(rig);

  progress(88, 'atmosphere');
  const pollen = buildPollen(scene);
  const fireflies = buildFireflies(scene);
  const birds = buildBirds(scene);

  progress(92, 'particle pool');
  // ── Particle pool ──
  const particlePool = [];
  const particleGeo = new THREE.SphereGeometry(0.06, 4, 3);
  const MAX_PARTICLES = 160;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    p.visible = false;
    p.userData = { active: false, vel: new THREE.Vector3(), life: 0, maxLife: 1, gravity: -4 };
    scene.add(p);
    particlePool.push(p);
  }
  let pCursor = 0;
  function spawnParticles(pos, opts = {}) {
    const n = opts.count || 8;
    for (let k = 0; k < n; k++) {
      const p = particlePool[pCursor];
      pCursor = (pCursor + 1) % MAX_PARTICLES;
      p.position.copy(pos);
      p.material.color.setHex(opts.color || 0xffe27a);
      p.material.opacity = 1;
      p.visible = true;
      const d = p.userData;
      d.active = true; d.life = opts.life || 1.2; d.maxLife = d.life; d.gravity = opts.gravity ?? -4;
      const sp = opts.spread || 2;
      d.vel.set((Math.random() - 0.5) * sp, Math.random() * (opts.up || 2) + 0.3, (Math.random() - 0.5) * sp);
      p.scale.setScalar(opts.scale || 1);
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particlePool[i], d = p.userData;
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) { d.active = false; p.visible = false; continue; }
      d.vel.y += d.gravity * dt;
      p.position.addScaledVector(d.vel, dt);
      p.material.opacity = d.life / d.maxLife;
    }
  }

  // ── State ──
  const state = {
    coins: 25, cropsHarvested: 0, water: 10, maxWater: 10,
    currentTool: 0, inventory: { seed: 3 },
    timeOfDay: 0.28, dayLength: 280, timeSpeed: 1.0,
    started: false,
    movement: { w: false, a: false, s: false, d: false, shift: false },
    quests: [
      { id: 'till', text: 'Plow 4 plots', target: 4, current: 0, done: false },
      { id: 'plant', text: 'Plant 3 seeds', target: 3, current: 0, done: false },
      { id: 'harvest', text: 'Harvest 2 tomatoes', target: 2, current: 0, done: false },
      { id: 'earn', text: 'Earn 60 coins', target: 60, current: 0, done: false },
    ],
    shakeTime: 0, hitStop: 0,
    cameraYaw: 0, cameraPitch: 0.72, cameraDist: 10,
    cameraTarget: new THREE.Vector3(0, 1, 0),
    lastActionTime: 0,
    landingMouse: { x: 0, y: 0 },
  };

  // ── Audio ──
  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
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
  function playThud() {
    if (!audioCtx) return;
    const bs = audioCtx.sampleRate * 0.12;
    const buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bs) * 0.5;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = 0.08;
    const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start();
    playChime(70, 0.15, 'sine', 0.05);
  }
  function playWater() {
    if (!audioCtx) return;
    const bs = audioCtx.sampleRate * 0.4;
    const buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2;
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start();
  }
  function playHarvest() {
    playChime(660, 0.15, 'sine', 0.05);
    setTimeout(() => playChime(880, 0.15, 'sine', 0.05), 80);
    setTimeout(() => playChime(1320, 0.25, 'sine', 0.04), 160);
  }

  // ── UI ──
  const $coins = document.getElementById('coins');
  const $crops = document.getElementById('crops');
  const $water = document.getElementById('water');
  const $hotbar = document.getElementById('hotbar');
  const $toast = document.getElementById('toast');
  const $questList = document.getElementById('quest-list');
  const $shop = document.getElementById('shop');

  const toolDefs = [
    { icon: '⛏️', label: 'Hoe' }, { icon: '💧', label: 'Water' },
    { icon: '🌱', label: 'Seed' }, { icon: '🧺', label: 'Pick' }, { icon: '🏪', label: 'Shop' },
  ];

  function buildHotbar() {
    $hotbar.innerHTML = '';
    toolDefs.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'slot' + (i === state.currentTool ? ' active' : '');
      el.innerHTML = `<span>${t.icon}</span><span class="label">${t.label}</span>`;
      if (i === 2) el.insertAdjacentHTML('beforeend', `<span class="count" id="seed-count">${state.inventory.seed}</span>`);
      el.onclick = e => { e.stopPropagation(); selectTool(i); };
      $hotbar.appendChild(el);
    });
  }
  function selectTool(i) {
    state.currentTool = i;
    updateHeldTool(i);
    buildHotbar();
    toggleShop(i === 4 ? true : false);
  }
  function updateCounts() {
    $coins.textContent = state.coins;
    $crops.textContent = state.cropsHarvested;
    $water.textContent = state.water;
    const sc = document.getElementById('seed-count');
    if (sc) sc.textContent = state.inventory.seed;
  }
  function updateQuests() {
    $questList.innerHTML = state.quests.map(q => {
      const done = q.current >= q.target;
      return `<div class="quest ${done ? 'done' : ''}"><span>${q.text}</span><span>${Math.min(q.current, q.target)}/${q.target}</span></div>`;
    }).join('');
  }
  function bumpQuest(id, amount = 1) {
    const q = state.quests.find(q => q.id === id);
    if (q && !q.done) {
      q.current += amount;
      if (q.current >= q.target) {
        q.done = true; state.coins += 15;
        toast(`✧ ${q.text} complete! +15🪙`);
        updateCounts();
      }
      updateQuests();
    }
  }
  let toastTimer = null;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2200);
    playChime(880, 0.22, 'sine', 0.04);
  }
  function toggleShop(force) {
    if (force === true) $shop.classList.add('open');
    else if (force === false) $shop.classList.remove('open');
    else $shop.classList.toggle('open');
  }
  document.querySelectorAll('.shop-item').forEach(item => {
    item.onclick = () => {
      const buy = item.dataset.buy;
      if (buy === 'seed' && state.coins >= 5) { state.coins -= 5; state.inventory.seed++; toast('+1 Tomato Seed'); }
      else if (buy === 'water' && state.coins >= 3) { state.coins -= 3; state.water = state.maxWater; toast('Watering can refilled'); }
      else if (buy === 'scarecrow' && state.coins >= 40) { state.coins -= 40; spawnScarecrow(); toast('A scarecrow appears...'); }
      else toast('Not enough coins');
      updateCounts();
    };
  });

  function spawnScarecrow() {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 5), poleMat);
    pole.position.y = 1.25; pole.castShadow = true; g.add(pole);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.07), poleMat);
    arms.position.y = 1.9; arms.castShadow = true; g.add(arms);
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.35), new THREE.MeshStandardMaterial({ color: 0xa83a3a, roughness: 0.9 }));
    shirt.position.y = 1.7; shirt.castShadow = true; g.add(shirt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8c890 }));
    head.position.y = 2.4; head.castShadow = true; g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
    hat.position.y = 2.85; hat.castShadow = true; g.add(hat);
    const a = Math.random() * Math.PI * 2, r = HALF_GRID + 4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.position.set(x, terrainHeight(x, z), z);
    scene.add(g);
  }

  // ── Input ──
  addEventListener('keydown', e => {
    if (!state.started) return;
    const k = e.key.toLowerCase();
    if (k === 'w') state.movement.w = true;
    if (k === 'a') state.movement.a = true;
    if (k === 's') state.movement.s = true;
    if (k === 'd') state.movement.d = true;
    if (k === 'shift') state.movement.shift = true;
    if (k >= '1' && k <= '5') selectTool(parseInt(k) - 1);
    if (k === 'e') toggleShop();
  });
  addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w') state.movement.w = false;
    if (k === 'a') state.movement.a = false;
    if (k === 's') state.movement.s = false;
    if (k === 'd') state.movement.d = false;
    if (k === 'shift') state.movement.shift = false;
  });

  let pointerLocked = false;
  renderer.domElement.addEventListener('click', () => {
    if (!state.started) return;
    if (!pointerLocked && !('ontouchstart' in window)) {
      renderer.domElement.requestPointerLock?.();
      return;
    }
    doAction();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });
  document.addEventListener('mousemove', e => {
    if (pointerLocked) {
      state.cameraYaw -= e.movementX * 0.0032;
      state.cameraPitch = Math.max(0.2, Math.min(1.35, state.cameraPitch + e.movementY * 0.0022));
    }
  });
  addEventListener('wheel', e => {
    state.cameraDist = Math.max(6, Math.min(20, state.cameraDist + e.deltaY * 0.008));
  }, { passive: true });

  let touchStart = null;
  renderer.domElement.addEventListener('touchstart', e => {
    if (!state.started) return;
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchmove', e => {
    if (!state.started || !touchStart) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      state.cameraYaw -= (t.clientX - touchStart.x) * 0.006;
      state.cameraPitch = Math.max(0.2, Math.min(1.35, state.cameraPitch + (t.clientY - touchStart.y) * 0.004));
      touchStart.x = t.clientX; touchStart.y = t.clientY;
    }
  }, { passive: true });
  renderer.domElement.addEventListener('touchend', () => {
    if (touchStart && Date.now() - touchStart.t < 220) doAction();
    touchStart = null;
  });

  function checkOrientation() {
    document.getElementById('rotate').classList.toggle('show', innerWidth > innerHeight && innerWidth < 900);
  }
  checkOrientation();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    checkOrientation();
  });

  // ── Actions ──
  function cellAt(x, z) {
    const gx = Math.floor((x + HALF_GRID) / CELL);
    const gz = Math.floor((z + HALF_GRID) / CELL);
    if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return null;
    return farmCells[gz * GRID_SIZE + gx];
  }
  const _fwd = new THREE.Vector3();
  function doAction() {
    const now = performance.now() / 1000;
    if (now - state.lastActionTime < 0.28) return;
    state.lastActionTime = now;
    animator.triggerTool();
    player.getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
    const cell = cellAt(player.position.x + _fwd.x * 1.7, player.position.z + _fwd.z * 1.7);
    if (!cell) return;
    const t = state.currentTool;
    if (t === 0) {
      if (cell.state === 'grass') {
        cell.state = 'tilled';
        cell.base.material = matTilled;
        cell.base.position.y = 0.07;
        spawnParticles(new THREE.Vector3(cell.x, 0.35, cell.z), { color: 0x8b5a2a, count: 16, spread: 1.8, up: 2.5, life: 0.9, gravity: -6 });
        bumpQuest('till'); toast('Soil tilled'); playThud();
      }
    } else if (t === 1) {
      if (state.water > 0 && (cell.state === 'tilled' || cell.state === 'planted' || cell.state === 'harvestable')) {
        state.water--; updateCounts();
        cell.base.material = matWet;
        cell.waterTime = 32;
        if (cell.state === 'tilled') cell.state = 'watered';
        spawnParticles(new THREE.Vector3(cell.x, 1.0, cell.z), { color: 0x88ccff, count: 18, spread: 0.8, up: 0.5, life: 1.1, gravity: -9 });
        toast('Watered'); playWater();
      } else if (state.water <= 0) toast('Out of water!');
    } else if (t === 2) {
      if (state.inventory.seed > 0 && (cell.state === 'tilled' || cell.state === 'watered')) {
        state.inventory.seed--;
        cell.state = 'planted';
        cell.growTime = 0.02;
        cell.growthStage = 0;
        updateCropMesh(cell, plotsGroup);
        updateCounts(); bumpQuest('plant');
        spawnParticles(new THREE.Vector3(cell.x, 0.4, cell.z), { color: 0xffdd66, count: 10, spread: 0.8, up: 1.2, life: 0.8 });
        toast('Seed planted'); playChime(600, 0.15, 'sine', 0.04);
      } else if (state.inventory.seed <= 0) toast('No seeds — visit the shop!');
    } else if (t === 3) {
      if (cell.state === 'harvestable') {
        state.cropsHarvested++;
        state.coins += 12;
        cell.state = 'tilled';
        cell.growTime = 0;
        cell.growthStage = -1;
        cell.base.material = matTilled;
        updateCropMesh(cell, plotsGroup);
        updateCounts(); bumpQuest('harvest'); bumpQuest('earn', 12);
        spawnParticles(new THREE.Vector3(cell.x, 0.9, cell.z), { color: 0xff6a3a, count: 20, spread: 1.4, up: 2.8, life: 1.2, gravity: -8 });
        spawnParticles(new THREE.Vector3(cell.x, 0.9, cell.z), { color: 0xffe27a, count: 8, spread: 1.0, up: 2.5, life: 1.4, gravity: -4 });
        toast('+12🪙 · 🍅 harvested');
        state.shakeTime = 1.2;
        state.hitStop = 0.06;
        chromaPass.uniforms.amount.value = 0.6;
        updateCounts(); playHarvest();
      } else toast('Nothing to harvest here');
    }
    saveGame();
  }

  // ── Player update ──
  const velocity = new THREE.Vector3();
  const wishDir = new THREE.Vector3();
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function updatePlayer(dt, elapsed) {
    const mv = state.movement;
    const speed = mv.shift ? 7.5 : 4.0;
    _forward.set(-Math.sin(state.cameraYaw), 0, -Math.cos(state.cameraYaw));
    _right.set(Math.cos(state.cameraYaw), 0, -Math.sin(state.cameraYaw));
    wishDir.set(0, 0, 0);
    if (mv.w) wishDir.add(_forward);
    if (mv.s) wishDir.sub(_forward);
    if (mv.d) wishDir.add(_right);
    if (mv.a) wishDir.sub(_right);
    if (wishDir.lengthSq() > 0) wishDir.normalize();
    velocity.lerp(wishDir.multiplyScalar(speed), Math.min(1, dt * 11));
    const moveAmt = velocity.length();
    if (moveAmt > 0.05) {
      player.position.addScaledVector(velocity, dt);
      const tr = Math.atan2(velocity.x, velocity.z);
      player.rotation.y = lerpAngle(player.rotation.y, tr, Math.min(1, dt * 9));
    }
    player.position.x = Math.max(-HALF_WORLD + 2, Math.min(HALF_WORLD - 2, player.position.x));
    player.position.z = Math.max(-HALF_WORLD + 2, Math.min(HALF_WORLD - 2, player.position.z));
    player.position.y = terrainHeight(player.position.x, player.position.z);
    animator.update(dt, moveAmt, elapsed, moveAmt > 0.3);
  }

  // ── Camera ──
  const camTarget = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  function updateCamera(dt) {
    camTarget.copy(player.position); camTarget.y += 1.4;
    state.cameraTarget.lerp(camTarget, Math.min(1, dt * 7));
    const x = Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;
    const y = Math.sin(state.cameraPitch) * state.cameraDist + 0.8;
    const z = Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist;
    camDesired.set(state.cameraTarget.x + x, state.cameraTarget.y + y, state.cameraTarget.z + z);
    camDesired.y = Math.max(camDesired.y, terrainHeight(camDesired.x, camDesired.z) + 1.6);
    camera.position.lerp(camDesired, Math.min(1, dt * 9));
    if (state.shakeTime > 0) {
      const sh = state.shakeTime * 0.08;
      camera.position.x += (Math.random() - 0.5) * sh;
      camera.position.y += (Math.random() - 0.5) * sh;
      state.shakeTime = Math.max(0, state.shakeTime - dt * 3.5);
    }
    camera.lookAt(state.cameraTarget);
  }

  // ── Time of day ──
  let lastSunAngle = 0;
  function updateTimeOfDay(dt) {
    state.timeOfDay = (state.timeOfDay + dt / state.dayLength * state.timeSpeed) % 1;
    const t = state.timeOfDay;
    const angle = (t - 0.25) * Math.PI * 2;
    const sunX = Math.cos(angle) * 80, sunY = Math.sin(angle) * 60, sunZ = -Math.cos(angle) * 20;
    sunMesh.position.set(sunX, sunY, sunZ);
    sunLight.position.set(sunX * 0.5, Math.max(5, sunY), sunZ * 0.5);
    sunLight.target.position.copy(player.position);
    sunLight.target.updateMatrixWorld();
    skyMat.uniforms.sunPos.value.copy(sunMesh.position).normalize();
    if (Math.abs(angle - lastSunAngle) > 0.035) {
      sunLight.shadow.needsUpdate = true;
      lastSunAngle = angle;
    }
    const night = new THREE.Color(0x0a1530);
    const dawn = new THREE.Color(0xffb070);
    const dusk = new THREE.Color(0xff8850);
    const noon = new THREE.Color(0x5a9bd8);
    const skyLo = new THREE.Color(0xd8e8f0);
    let skyTop, skyBot, sunCol, sunInt, hemiInt, fogCol;
    if (t < 0.2) {
      skyTop = night.clone(); skyBot = new THREE.Color(0x1a2a50);
      sunCol = new THREE.Color(0x4a6a9a);
      sunInt = 0.15; hemiInt = 0.28; fogCol = night.clone();
    } else if (t < 0.28) {
      const k = (t - 0.2) / 0.08;
      skyTop = night.clone().lerp(dawn, k);
      skyBot = new THREE.Color(0x1a2a50).lerp(dawn, k);
      sunCol = new THREE.Color(0x4a6a9a).lerp(dawn, k);
      sunInt = 0.15 + k * 1.3; hemiInt = 0.28 + k * 0.75;
      fogCol = night.clone().lerp(dawn, k);
    } else if (t < 0.72) {
      const k = Math.abs(t - 0.5) / 0.22;
      skyTop = noon.clone().lerp(new THREE.Color(0x4a8bc8), k * 0.3);
      skyBot = skyLo.clone();
      sunCol = new THREE.Color(0xfff2d0);
      sunInt = 1.55 - k * 0.2; hemiInt = 1.05;
      fogCol = new THREE.Color(0xa8d8e8);
    } else if (t < 0.82) {
      const k = (t - 0.72) / 0.10;
      skyTop = new THREE.Color(0x5a9bd8).lerp(dusk, k);
      skyBot = new THREE.Color(0xd8e8f0).lerp(dusk, k);
      sunCol = new THREE.Color(0xfff2d0).lerp(dusk, k);
      sunInt = 1.35 - k * 0.9; hemiInt = 1.05 - k * 0.55;
      fogCol = new THREE.Color(0xa8d8e8).lerp(dusk, k);
    } else {
      const k = (t - 0.82) / 0.18;
      skyTop = dusk.clone().lerp(night, k);
      skyBot = dusk.clone().lerp(new THREE.Color(0x1a2a50), k);
      sunCol = dusk.clone().lerp(new THREE.Color(0x4a6a9a), k);
      sunInt = 0.45 - k * 0.3; hemiInt = 0.5 - k * 0.22;
      fogCol = dusk.clone().lerp(night, k);
    }
    skyMat.uniforms.topColor.value.copy(skyTop);
    skyMat.uniforms.bottomColor.value.copy(skyBot);
    skyMat.uniforms.sunColor.value.copy(sunCol);
    sunLight.color.copy(sunCol); sunLight.intensity = sunInt;
    hemiLight.intensity = hemiInt;
    scene.fog.color.copy(fogCol); scene.background.copy(fogCol);
    sunMesh.material.color.copy(t < 0.25 || t > 0.75 ? new THREE.Color(0xdde8ff) : new THREE.Color(0xffe8a0));
    const dayness = Math.max(0, 1 - Math.abs(t - 0.5) * 3);
    starMat.opacity = Math.max(0, 1 - dayness * 1.3);
    fireflies.mat.opacity = Math.max(0, 1 - dayness * 1.2) * 0.85;
    bloom.strength = 0.3 + (1 - dayness) * 0.35;
  }

  // ── World animation ──
  let elapsed = 0;
  function updateWorldAnimations(dt) {
    const px = player.position.x, pz = player.position.z;
    for (const tr of veg.treeGroup.children) {
      const d = tr.userData;
      const dx = d.baseX - px, dz = d.baseZ - pz;
      if (dx * dx + dz * dz < 2200) {
        const sway = Math.sin(elapsed * d.swaySpeed + d.sway) * 0.022;
        tr.rotation.z = sway;
        tr.rotation.x = sway * 0.55;
      }
    }
    // Grass — every other frame
    if ((elapsed * 60 | 0) % 2 === 0) {
      const gDummy = veg.gDummy;
      for (let i = 0; i < veg.grassData.length; i++) {
        const d = veg.grassData[i];
        const sway = Math.sin(elapsed * 1.8 + d.phase + d.x * 0.3) * 0.16;
        gDummy.position.set(d.x, d.y, d.z);
        gDummy.rotation.set(sway, d.baseRot, sway * 0.7);
        gDummy.scale.set(d.s, d.s, d.s);
        gDummy.updateMatrix();
        veg.grassMesh.setMatrixAt(i, gDummy.matrix);
      }
      veg.grassMesh.instanceMatrix.needsUpdate = true;
    }
    const fDummy = veg.fDummy;
    for (let i = 0; i < veg.flowerData.length; i++) {
      const d = veg.flowerData[i];
      const bob = Math.sin(elapsed * 2 + d.phase) * 0.04;
      fDummy.position.set(d.x, d.baseY + bob, d.z);
      fDummy.rotation.set(Math.sin(elapsed * 1.4 + d.phase) * 0.2, d.phase, Math.cos(elapsed * 1.2 + d.phase) * 0.15);
      fDummy.scale.setScalar(0.7 + Math.sin(d.phase) * 0.1);
      fDummy.updateMatrix();
      veg.flowerMesh.setMatrixAt(i, fDummy.matrix);
    }
    veg.flowerMesh.instanceMatrix.needsUpdate = true;

    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 90) c.position.x = -90;
    }
    pond.mat.color.setHSL(0.55, 0.4, 0.42 + Math.sin(elapsed) * 0.03);

    const pp = pollen.points.geometry.attributes.position;
    for (let i = 0; i < pollen.count; i++) {
      const v = pollen.vel[i];
      pp.array[i * 3] += v.x * dt;
      pp.array[i * 3 + 1] += v.y * dt + Math.cos(elapsed * 0.7 + v.phase) * 0.002;
      pp.array[i * 3 + 2] += v.z * dt;
      if (pp.array[i * 3 + 1] > 14) pp.array[i * 3 + 1] = 1;
      if (pp.array[i * 3 + 1] < 0.5) pp.array[i * 3 + 1] = 1;
    }
    pp.needsUpdate = true;

    const fp = fireflies.points.geometry.attributes.position;
    for (let i = 0; i < fireflies.count; i++) {
      const d = fireflies.data[i];
      fp.array[i * 3] += Math.sin(elapsed * d.speed + d.phase) * 0.01;
      fp.array[i * 3 + 1] += Math.cos(elapsed * d.speed * 1.3 + d.phase) * 0.008;
      fp.array[i * 3 + 2] += Math.cos(elapsed * d.speed * 0.8 + d.phase) * 0.01;
    }
    fp.needsUpdate = true;

    for (const b of birds) {
      const d = b.userData;
      d.angle += dt * 0.15;
      b.position.set(Math.cos(d.angle) * d.radius, d.height + Math.sin(elapsed * 0.8 + d.phase) * 2, Math.sin(d.angle) * d.radius);
      b.rotation.y = -d.angle + Math.PI / 2;
      const flap = Math.sin(elapsed * 8 + d.phase) * 0.5;
      d.wings[0].rotation.z = -flap;
      d.wings[1].rotation.z = flap;
    }

    for (const cell of farmCells) {
      if (cell.mesh) {
        const sway = Math.sin(elapsed * 1.5 + cell.gx * 0.3 + cell.gz * 0.4) * 0.05;
        cell.mesh.rotation.z = sway;
        cell.mesh.rotation.x = sway * 0.5;
      }
    }
  }

  // ── Farm logic ──
  let farmTimer = 0;
  const FARM_TICK = 0.35;
  function tickFarm(dt) {
    for (const cell of farmCells) {
      if (cell.state === 'planted') {
        let rate = 0.0065;
        if (cell.base.material === matWet) rate *= 2.6;
        cell.growTime = Math.min(1, cell.growTime + dt * rate);
        const stage = cropStageOf(cell.growTime);
        if (stage !== cell.growthStage) {
          cell.growthStage = stage;
          updateCropMesh(cell, plotsGroup);
        }
        if (cell.growTime >= 1) {
          cell.state = 'harvestable';
          updateCropMesh(cell, plotsGroup);
          spawnParticles(new THREE.Vector3(cell.x, 1.0, cell.z), { color: 0xffe27a, count: 6, spread: 0.8, up: 1.2, life: 1.0, gravity: -2 });
        }
      }
      if (cell.waterTime > 0) {
        cell.waterTime -= dt;
        if (cell.waterTime <= 0) {
          if (cell.base.material === matWet) cell.base.material = (cell.state === 'grass') ? matGrass : matTilled;
          if (cell.state === 'watered') cell.state = 'tilled';
        }
      }
    }
  }
  function updateFarmLogic(dt) {
    farmTimer += dt;
    while (farmTimer >= FARM_TICK) { farmTimer -= FARM_TICK; tickFarm(FARM_TICK); }
  }

  // ── Save / load ──
  function saveGame() {
    if (!state.started) return;
    try {
      localStorage.setItem('verdant-vale-3', JSON.stringify({
        coins: state.coins, cropsHarvested: state.cropsHarvested,
        water: state.water, inventory: state.inventory,
        timeOfDay: state.timeOfDay, quests: state.quests,
        cells: farmCells.map(c => ({ state: c.state, growTime: c.growTime, waterTime: c.waterTime })),
      }));
    } catch (e) {}
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem('verdant-vale-3');
      if (!raw) return;
      const data = JSON.parse(raw);
      state.coins = data.coins ?? state.coins;
      state.cropsHarvested = data.cropsHarvested ?? 0;
      state.water = data.water ?? state.water;
      state.inventory = data.inventory ?? state.inventory;
      state.timeOfDay = data.timeOfDay ?? state.timeOfDay;
      if (data.quests) state.quests = data.quests;
      if (data.cells) {
        data.cells.forEach((saved, i) => {
          const cell = farmCells[i];
          if (!cell) return;
          cell.state = saved.state;
          cell.growTime = saved.growTime;
          cell.waterTime = saved.waterTime;
          if (cell.state === 'tilled') cell.base.material = matTilled;
          else if (cell.state === 'watered') cell.base.material = matWet;
          else if (cell.state === 'planted' || cell.state === 'harvestable') {
            cell.base.material = saved.waterTime > 0 ? matWet : matTilled;
            cell.growthStage = cropStageOf(cell.growTime);
            updateCropMesh(cell, plotsGroup);
          }
        });
      }
    } catch (e) {}
  }
  setInterval(saveGame, 8000);

  // ── Init player position ──
  player.position.set(0, 0, HALF_GRID + 3);
  state.cameraTarget.copy(player.position);
  updateHeldTool(0);
  buildHotbar();
  updateCounts();
  updateQuests();
  loadGame();
  updateCounts();

  camera.position.set(
    state.cameraTarget.x + Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist,
    state.cameraTarget.y + Math.sin(state.cameraPitch) * state.cameraDist + 0.8,
    state.cameraTarget.z + Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * state.cameraDist
  );
  camera.lookAt(state.cameraTarget);

  progress(96, 'opening the gate');

  // ── Landing reveal ──
  setTimeout(() => {
    document.getElementById('loader').classList.add('hide');
    const landing = document.getElementById('landing');
    landing.style.display = 'flex';
    const titleEl = document.getElementById('gameTitle');
    const text = 'VERDANT VALE';
    titleEl.innerHTML = text.split('').map((ch, i) =>
      `<span style="animation-delay:${i * 0.05}s">${ch === ' ' ? '&nbsp;' : ch}</span>`
    ).join('');
    progress(100, 'ready');
  }, 300);

  const landing = document.getElementById('landing');
  landing.addEventListener('mousemove', e => {
    state.landingMouse.x = (e.clientX / innerWidth - 0.5) * 2;
    state.landingMouse.y = (e.clientY / innerHeight - 0.5) * 2;
  });

  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', e => {
    const rect = playBtn.getBoundingClientRect();
    const rip = document.createElement('div');
    rip.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    rip.style.width = rip.style.height = size + 'px';
    rip.style.left = (e.clientX - rect.left - size / 2) + 'px';
    rip.style.top = (e.clientY - rect.top - size / 2) + 'px';
    playBtn.appendChild(rip);
    setTimeout(() => rip.remove(), 700);

    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    playChime(660, 0.2, 'sine', 0.08);
    setTimeout(() => playChime(990, 0.3, 'sine', 0.06), 90);

    landing.classList.add('wipe');
    setTimeout(() => {
      landing.classList.add('hide');
      document.getElementById('ui').classList.add('show');
      state.started = true;
      setTimeout(() => toast('Welcome to Verdant Vale 🌿'), 600);
      if (!('ontouchstart' in window)) {
        setTimeout(() => renderer.domElement.requestPointerLock?.(), 500);
      }
    }, 1100);
  });

  // ── Main loop ──
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    elapsed += dt;

    if (chromaPass.uniforms.amount.value > 0) {
      chromaPass.uniforms.amount.value = Math.max(0, chromaPass.uniforms.amount.value - dt * 3.5);
    }

    if (state.hitStop > 0) {
      state.hitStop -= dt;
      updateParticles(dt);
      composer.render();
      return;
    }

    if (state.started) {
      updateTimeOfDay(dt);
      updatePlayer(dt, elapsed);
      updateCamera(dt);
      updateWorldAnimations(dt);
      updateFarmLogic(dt);
    } else {
      updateTimeOfDay(dt);
      updateWorldAnimations(dt);
      state.cameraYaw += dt * 0.06;
      const py = state.cameraYaw + state.landingMouse.x * 0.2;
      const pp = state.cameraPitch + state.landingMouse.y * 0.08;
      const x = Math.sin(py) * Math.cos(pp) * state.cameraDist;
      const y = Math.sin(pp) * state.cameraDist + 0.8;
      const z = Math.cos(py) * Math.cos(pp) * state.cameraDist;
      camera.position.set(state.cameraTarget.x + x, state.cameraTarget.y + y, state.cameraTarget.z + z);
      camera.lookAt(state.cameraTarget);
    }

    updateParticles(dt);
    sunMesh.lookAt(camera.position);
    composer.render();
  }
  animate();

  // Safety: if loader stuck after 8s, force reveal
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (!loader.classList.contains('hide')) {
      loader.classList.add('hide');
      const l = document.getElementById('landing');
      if (l) l.style.display = 'flex';
    }
  }, 8000);
}