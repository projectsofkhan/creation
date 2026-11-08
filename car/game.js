// ============================================================================
// APEX DRIVE - CORE ENGINE
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CONFIGURATION & CONSTANTS
// ----------------------------------------------------------------------------
const CONFIG = {
  physics: {
    gravity: -25.0,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 3,
    airDensity: 1.225,
    dragCoefficient: 0.35
  },
  camera: {
    fov: 65,
    near: 0.1,
    far: 2000,
    followDistance: 8.5,
    followHeight: 3.5,
    lookAtHeight: 1.2,
    lerpSpeed: 5.0,
    shakeIntensity: 0.05
  },
  render: {
    pixelRatioCap: 2,
    fogColor: 0x0a0a14,
    fogDensity: 0.0025,
    skyGradientTop: '#070714',
    skyGradientMid: '#1a1a2e',
    skyGradientBot: '#2a2a3e',
    roadColor: '#222224',
    roadLineColor: '#ffdd00',
    grassColor: '#111a11',
    maxParticles: 200
  },
  cars: [
    { id: 'm5', name: 'BMW M5', power: 4500, drive: 'AWD', color: '#1a2338', length: 4.6, width: 1.9, mass: 1900, topSpeed: 72 },
    { id: 'mustang', name: 'Mustang 1969', power: 3800, drive: 'RWD', color: '#7a1c1c', length: 4.7, width: 1.9, mass: 1550, topSpeed: 62 },
    { id: 'porsche', name: 'Porsche 911', power: 4200, drive: 'RWD', color: '#2c2c2c', length: 4.4, width: 1.85, mass: 1420, topSpeed: 76 },
    { id: 'ferrari', name: 'LaFerrari', power: 5500, drive: 'RWD', color: '#b81414', length: 4.7, width: 1.95, mass: 1350, topSpeed: 92 }
  ]
};

// ----------------------------------------------------------------------------
// 2. MATH & UTILITIES
// ----------------------------------------------------------------------------
const MathUtils = {
  clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
  lerp: (a, b, t) => a + (b - a) * t,
  inverseLerp: (a, b, v) => (v - a) / (b - a),
  smoothstep: (edge0, edge1, x) => {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  toRadians: (deg) => deg * (Math.PI / 180),
  toDegrees: (rad) => rad * (180 / Math.PI),
  randomRange: (min, max) => Math.random() * (max - min) + min,
  randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  formatTime: (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const msStr = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msStr}`;
  }
};

const DOM = {
  rotateOverlay: document.getElementById('rotate-overlay'),
  loadingScreen: document.getElementById('loading-screen'),
  loaderFill: document.getElementById('loader-fill'),
  loaderText: document.getElementById('loader-text'),
  selectScreen: document.getElementById('select-screen'),
  carGrid: document.getElementById('car-grid'),
  startBtn: document.getElementById('start-btn'),
  hud: document.getElementById('hud'),
  hudCarName: document.getElementById('hud-car-name'),
  hudTransMode: document.getElementById('hud-trans-mode'),
  speedoValue: document.getElementById('speedo-value'),
  speedoGear: document.getElementById('speedo-gear'),
  speedoArc: document.getElementById('speedo-arc'),
  btnBack: document.getElementById('btn-back'),
  btnLeft: document.getElementById('btn-left'),
  btnRight: document.getElementById('btn-right'),
  btnGas: document.getElementById('btn-gas'),
  btnBrake: document.getElementById('btn-brake'),
  btnPadUp: document.getElementById('btn-pad-up'),
  btnPadDown: document.getElementById('btn-pad-down'),
  canvas: document.getElementById('render-canvas')
};

// ----------------------------------------------------------------------------
// 3. STATE MANAGER
// ----------------------------------------------------------------------------
const State = {
  isRunning: false,
  isPaused: false,
  carIndex: 0,
  speed: 0, // m/s
  rpm: 900,
  gear: 1,
  throttle: 0,
  brake: 0,
  steer: 0,
  wheelSpin: 0,
  distance: 0,
  time: 0,
  manualMode: false,
  particles: [],
  input: {
    gas: false, brake: false, left: false, right: false
  }
};

// ----------------------------------------------------------------------------
// 4. AUDIO ENGINE (Procedural Web Audio API)
// ----------------------------------------------------------------------------
class EngineAudio {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.masterGain = null;
    this.oscillators = [];
    this.filter = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0;
      this.masterGain.connect(this.ctx.destination);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 400;
      this.filter.Q.value = 2;
      this.filter.connect(this.masterGain);

      const freqs = [40, 80, 160];
      const types = ['sawtooth', 'square', 'sawtooth'];
      
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = types[i];
        osc.frequency.value = f;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.3 / (i + 1);
        osc.connect(gain);
        gain.connect(this.filter);
        osc.start();
        this.oscillators.push(osc);
      });

      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  update(rpm, throttle) {
    if (!this.initialized) return;
    
    // Guard against NaN/Infinity
    const safeRpm = isFinite(rpm) ? MathUtils.clamp(rpm, 900, 8000) : 900;
    const safeThrottle = isFinite(throttle) ? MathUtils.clamp(throttle, 0, 1) : 0;
    
    const baseFreq = 30 + (safeRpm / 8000) * 150;
    const now = this.ctx.currentTime;

    this.oscillators[0].frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.oscillators[1].frequency.setTargetAtTime(baseFreq * 2.01, now, 0.05);
    this.oscillators[2].frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    const filterFreq = 300 + safeThrottle * 1200 + (safeRpm / 8000) * 600;
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);

    const vol = 0.1 + safeThrottle * 0.15;
    this.masterGain.gain.setTargetAtTime(vol, now, 0.1);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  mute() {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }
}
const audio = new EngineAudio();

// ----------------------------------------------------------------------------
// 5. RENDERER & CANVAS
// ----------------------------------------------------------------------------
const canvas = DOM.canvas;
const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;

function handleResize() {
  const isPortrait = window.innerHeight > window.innerWidth;
  width = isPortrait ? window.innerHeight : window.innerWidth;
  height = isPortrait ? window.innerWidth : window.innerHeight;
  
  canvas.width = width * Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap);
  canvas.height = height * Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap);
  
  ctx.scale(Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap), Math.min(window.devicePixelRatio, CONFIG.render.pixelRatioCap));
}
window.addEventListener('resize', handleResize);
handleResize();

// ----------------------------------------------------------------------------
// 6. WORLD RENDERER (Pseudo-3D)
// ----------------------------------------------------------------------------
function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, CONFIG.render.skyGradientTop);
  gradient.addColorStop(0.5, CONFIG.render.skyGradientMid);
  gradient.addColorStop(1, CONFIG.render.skyGradientBot);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawRoad() {
  const horizon = height * 0.45;
  const roadWidthTop = width * 0.04;
  const roadWidthBot = width * 1.8;
  
  const startX = width / 2;
  const startY = horizon;
  const endY = height;

  // Grass
  ctx.fillStyle = CONFIG.render.grassColor;
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(startX - roadWidthTop, startY);
  ctx.lineTo(startX - roadWidthBot, endY);
  ctx.lineTo(0, endY);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, startY);
  ctx.lineTo(startX + roadWidthTop, startY);
  ctx.lineTo(startX + roadWidthBot, endY);
  ctx.lineTo(width, endY);
  ctx.fill();

  // Road Base
  ctx.fillStyle = CONFIG.render.roadColor;
  ctx.beginPath();
  ctx.moveTo(startX - roadWidthTop, startY);
  ctx.lineTo(startX + roadWidthTop, startY);
  ctx.lineTo(startX + roadWidthBot, endY);
  ctx.lineTo(startX - roadWidthBot, endY);
  ctx.fill();

  // Road Edge Lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startX - roadWidthTop + 10, startY);
  ctx.lineTo(startX - roadWidthBot + (width * 0.1), endY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(startX + roadWidthTop - 10, startY);
  ctx.lineTo(startX + roadWidthBot - (width * 0.1), endY);
  ctx.stroke();

  // Center Dashes
  ctx.strokeStyle = CONFIG.render.roadLineColor;
  const dashCount = 20;
  const offset = (State.distance * 2) % 1;
  
  for (let i = 0; i < dashCount; i++) {
    const t1 = (i + offset) / dashCount;
    const t2 = (i + 0.4 + offset) / dashCount;
    if (t2 > 1) continue;
    
    const y1 = startY + (endY - startY) * t1 * t1;
    const y2 = startY + (endY - startY) * t2 * t2;
    
    ctx.lineWidth = 2 + (t1 * 8);
    ctx.beginPath();
    ctx.moveTo(startX, y1);
    ctx.lineTo(startX, y2);
    ctx.stroke();
  }
}

function drawPlayerCar() {
  const car = CONFIG.cars[State.carIndex];
  const carW = width * 0.28;
  const carH = carW * 0.42;
  
  // Steering shifts car slightly
  const cx = (width / 2) + (State.steer * -30);
  const cy = height - carH - 40;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + carH - 5, carW * 0.55, carH * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chassis
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.moveTo(cx - carW/2, cy + carH/2);
  ctx.lineTo(cx - carW/2 + 15, cy);
  ctx.lineTo(cx + carW/2 - 15, cy);
  ctx.lineTo(cx + carW/2, cy + carH/2);
  ctx.lineTo(cx + carW/2 - 10, cy + carH);
  ctx.lineTo(cx - carW/2 + 10, cy + carH);
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.moveTo(cx - carW*0.3, cy + 8);
  ctx.lineTo(cx + carW*0.3, cy + 8);
  ctx.lineTo(cx + carW*0.4, cy + carH*0.5);
  ctx.lineTo(cx - carW*0.4, cy + carH*0.5);
  ctx.fill();

  // Taillights
  ctx.fillStyle = '#ff1111';
  ctx.shadowColor = '#ff1111';
  ctx.shadowBlur = 10;
  ctx.fillRect(cx - carW*0.45, cy + carH*0.6, carW*0.15, carH*0.2);
  ctx.fillRect(cx + carW*0.3, cy + carH*0.6, carW*0.15, carH*0.2);
  ctx.shadowBlur = 0;

  // Wheels
  const wheelW = carW * 0.15;
  const wheelH = carH * 0.4;
  ctx.fillStyle = '#000';
  
  // Spin calculation
  const spin = State.wheelSpin * 5;
  
  const drawWheel = (wx) => {
    ctx.fillRect(wx, cy + carH*0.55, wheelW, wheelH);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + wheelW/2 - Math.cos(spin)*wheelW*0.3, cy + carH*0.55 + wheelH/2 - Math.sin(spin)*wheelH*0.3);
    ctx.lineTo(wx + wheelW/2 + Math.cos(spin)*wheelW*0.3, cy + carH*0.55 + wheelH/2 + Math.sin(spin)*wheelH*0.3);
    ctx.stroke();
  };

  drawWheel(cx - carW/2 - 2);
  drawWheel(cx + carW/2 - wheelW + 2);
}

function drawParticles() {
  for (let i = State.particles.length - 1; i >= 0; i--) {
    const p = State.particles[i];
    p.life -= 0.02;
    p.y -= p.speed;
    p.x += p.drift;
    
    if (p.life <= 0) {
      State.particles.splice(i, 1);
      continue;
    }
    
    ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderScene() {
  ctx.clearRect(0, 0, width, height);
  
  drawSky();
  drawRoad();
  drawParticles();
  drawPlayerCar();
}

// ----------------------------------------------------------------------------
// 7. PHYSICS & SIMULATION
// ----------------------------------------------------------------------------
function updatePhysics(dt) {
  const car = CONFIG.cars[State.carIndex];
  
  // Inputs
  State.throttle = State.input.gas ? 1 : 0;
  State.brake = State.input.brake ? 1 : 0;
  
  // Steering
  const steerTarget = (State.input.left ? 1 : 0) - (State.input.right ? 1 : 0);
  State.steer += (steerTarget - State.steer) * 8 * dt;

  // Gear Ratios
  const ratios = [3.4, 2.3, 1.7, 1.3, 1.0, 0.8];
  const currentRatio = ratios[Math.min(State.gear - 1, ratios.length - 1)];
  
  // Forces
  const engineForce = State.throttle * (car.power * currentRatio * 0.08);
  const brakeForce = State.brake * 2500;
  const drag = State.speed * 2.5;
  
  // Update Speed
  State.speed += (engineForce - brakeForce - drag) * dt;
  State.speed = MathUtils.clamp(State.speed, 0, car.topSpeed);
  
  // Update Distance & Wheel Spin
  State.distance += State.speed * dt;
  State.wheelSpin += (State.speed * 0.8) * dt;
  
  // RPM Calculation
  const targetRpm = 900 + (State.speed / car.topSpeed) * 7000;
  State.rpm += (targetRpm - State.rpm) * 5 * dt;
  
  // Auto Gearbox (if not in manual mode)
  if (!State.manualMode) {
    if (State.rpm > 6500 && State.gear < 6) {
      State.gear++;
      updateGearUI();
    }
    if (State.rpm < 3000 && State.gear > 1) {
      State.gear--;
      updateGearUI();
    }
  }

  // Exhaust Particles
  if (State.throttle > 0 && Math.random() > 0.5) {
    State.particles.push({
      x: (width / 2) + (State.steer * -30) + MathUtils.randomRange(-20, 20),
      y: height - 80,
      size: MathUtils.randomRange(5, 15),
      life: 1.0,
      speed: MathUtils.randomRange(2, 5),
      drift: MathUtils.randomRange(-1, 1)
    });
  }
}

// ----------------------------------------------------------------------------
// 8. GAME LOOP
// ----------------------------------------------------------------------------
let lastTime = performance.now();
let accumulator = 0;

function gameLoop(time) {
  requestAnimationFrame(gameLoop);
  
  let dt = (time - lastTime) / 1000;
  lastTime = time;
  
  if (!isFinite(dt) || dt > 0.1) dt = 0.016;
  if (dt <= 0) dt = 0.016;

  if (State.isRunning && !State.isPaused) {
    accumulator += dt;
    let steps = 0;
    
    while (accumulator >= CONFIG.physics.fixedTimeStep && steps < CONFIG.physics.maxSubSteps) {
      updatePhysics(CONFIG.physics.fixedTimeStep);
      accumulator -= CONFIG.physics.fixedTimeStep;
      steps++;
    }
    if (steps >= CONFIG.physics.maxSubSteps) accumulator = 0;
    
    State.time += dt;
    
    // Update Audio
    audio.update(State.rpm, State.throttle);
    
    // Update HUD
    updateHUD();
  }
  
  renderScene();
}

// ----------------------------------------------------------------------------
// 9. UI UPDATES
// ----------------------------------------------------------------------------
function updateHUD() {
  const kmh = Math.round(State.speed * 3.6);
  DOM.speedoValue.textContent = isFinite(kmh) ? kmh : 0;
  
  const maxDisplay = 300;
  const ratio = MathUtils.clamp(kmh / maxDisplay, 0, 1);
  DOM.speedoArc.setAttribute('stroke-dasharray', `${ratio * 267} 267`);
}

function updateGearUI() {
  DOM.speedoGear.textContent = State.gear;
  if (State.manualMode) {
    DOM.hudTransMode.textContent = "MANUAL";
  } else {
    DOM.hudTransMode.textContent = "AUTOMATIC";
  }
}

// ----------------------------------------------------------------------------
// 10. INPUT HANDLING
// ----------------------------------------------------------------------------
function setupInputs() {
  const bindHold = (el, onDown, onUp) => {
    const start = (e) => { e.preventDefault(); el.classList.add('pressed'); onDown(); };
    const end = (e) => { e.preventDefault(); el.classList.remove('pressed'); onUp(); };
    
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };

  bindHold(DOM.btnLeft, () => State.input.left = true, () => State.input.left = false);
  bindHold(DOM.btnRight, () => State.input.right = true, () => State.input.right = false);
  bindHold(DOM.btnGas, () => State.input.gas = true, () => State.input.gas = false);
  bindHold(DOM.btnBrake, () => State.input.brake = true, () => State.input.brake = false);

  // Paddle Shifters (Manual Override)
  DOM.btnPadUp.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (State.isRunning) {
      State.manualMode = true;
      State.gear = Math.min(State.gear + 1, 6);
      updateGearUI();
    }
  });

  DOM.btnPadDown.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (State.isRunning) {
      State.manualMode = true;
      State.gear = Math.max(State.gear - 1, 1);
      updateGearUI();
    }
  });

  // Keyboard Support (for PC testing)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp' || e.key === 'w') State.input.gas = true;
    if (e.key === 'ArrowDown' || e.key === 's') State.input.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') State.input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') State.input.right = true;
    if (e.key === 'Shift') {
      State.manualMode = true;
      State.gear = Math.min(State.gear + 1, 6);
      updateGearUI();
    }
    if (e.key === 'Control') {
      State.manualMode = true;
      State.gear = Math.max(State.gear - 1, 1);
      updateGearUI();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') State.input.gas = false;
    if (e.key === 'ArrowDown' || e.key === 's') State.input.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') State.input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') State.input.right = false;
  });
}

// ----------------------------------------------------------------------------
// 11. SCREEN MANAGEMENT
// ----------------------------------------------------------------------------
const SVG_CARS = {
  m5: `<svg viewBox="0 0 120 50"><path d="M 15 35 L 25 20 L 95 20 L 105 35 Z" /><circle cx="30" cy="37" r="7"/><circle cx="90" cy="37" r="7"/></svg>`,
  mustang: `<svg viewBox="0 0 120 50"><path d="M 10 35 L 20 18 L 100 18 L 110 35 Z" /><circle cx="28" cy="37" r="7"/><circle cx="92" cy="37" r="7"/></svg>`,
  porsche: `<svg viewBox="0 0 120 50"><path d="M 20 35 L 30 22 L 90 22 L 100 35 Z" /><circle cx="33" cy="37" r="7"/><circle cx="87" cy="37" r="7"/></svg>`,
  ferrari: `<svg viewBox="0 0 120 50"><path d="M 15 35 L 22 16 L 98 16 L 105 35 Z" /><circle cx="30" cy="37" r="7"/><circle cx="90" cy="37" r="7"/></svg>`
};

function buildSelectScreen() {
  DOM.carGrid.innerHTML = '';
  CONFIG.cars.forEach((car, i) => {
    const card = document.createElement('div');
    card.className = `car-card ${i === 0 ? 'active' : ''}`;
    card.innerHTML = `
      <div class="car-svg-container">${SVG_CARS[car.id]}</div>
      <div class="car-details">
        <div class="car-name">${car.name}</div>
        <div class="car-specs">
          <div class="car-spec-row"><span>DRIVE</span><span>${car.drive}</span></div>
          <div class="car-spec-row"><span>POWER</span><span>${car.power} hp</span></div>
        </div>
      </div>
    `;
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      document.querySelectorAll('.car-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      State.carIndex = i;
    });
    DOM.carGrid.appendChild(card);
  });
}

function startGame() {
  // Force Fullscreen
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

  // Init Audio
  audio.init();
  audio.resume();

  // UI Transitions
  DOM.selectScreen.classList.add('hidden');
  DOM.hud.classList.remove('hidden');
  
  // Reset State
  State.isRunning = true;
  State.speed = 0;
  State.rpm = 900;
  State.gear = 1;
  State.steer = 0;
  State.distance = 0;
  State.manualMode = false;
  State.particles = [];
  State.input = { gas: false, brake: false, left: false, right: false };
  
  // Update HUD Info
  DOM.hudCarName.textContent = CONFIG.cars[State.carIndex].name;
  updateGearUI();
  updateHUD();
  
  lastTime = performance.now();
  accumulator = 0;
}

function returnToMenu() {
  State.isRunning = false;
  State.isPaused = true;
  audio.mute();
  DOM.hud.classList.add('hidden');
  DOM.selectScreen.classList.remove('hidden');
}

// ----------------------------------------------------------------------------
// 12. BOOTSTRAP & INITIALIZATION
// ----------------------------------------------------------------------------
function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  DOM.rotateOverlay.classList.toggle('active', isPortrait);
}

function boot() {
  console.log("[BOOT] Initializing Apex Drive...");
  
  // UI Setup
  buildSelectScreen();
  setupInputs();
  
  // Events
  DOM.startBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); startGame(); });
  DOM.btnBack.addEventListener('pointerdown', (e) => { e.preventDefault(); returnToMenu(); });
  
  window.addEventListener('resize', checkOrientation);
  checkOrientation();

  // Simulated Loading Sequence
  let progress = 0;
  const loadInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 100) progress = 100;
    
    DOM.loaderFill.style.width = `${progress}%`;
    
    if (progress > 30) DOM.loaderText.textContent = "Loading Assets...";
    if (progress > 70) DOM.loaderText.textContent = "Preparing Track...";
    if (progress >= 100) {
      DOM.loaderText.textContent = "Ready.";
      clearInterval(loadInterval);
      
      setTimeout(() => {
        DOM.loadingScreen.classList.add('hidden');
        DOM.selectScreen.classList.remove('hidden');
        
        // Start Render Loop
        requestAnimationFrame(gameLoop);
      }, 400);
    }
  }, 150);
}

// Fire it up
window.addEventListener('load', boot);