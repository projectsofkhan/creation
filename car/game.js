// ============================================================================
// APEX DRIVE - ULTIMATE RACING ENGINE (GAME.JS)
// ============================================================================

// ----------------------------------------------------------------------------
// SECTION 1: CONFIGURATION AND CONSTANTS
// ----------------------------------------------------------------------------
const ENGINE_CONFIG = {
  physics: {
    gravity: -30.0,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 4,
    airDensity: 1.225,
    dragCoefficient: 0.35,
    frictionCoefficient: 0.8,
    rollingResistance: 0.015
  },
  camera: {
    fov: 68,
    near: 0.5,
    far: 3000,
    followDistance: 9.0,
    followHeight: 3.8,
    lookAtHeight: 1.2,
    lerpFactor: 6.0,
    shakeIntensity: 0.08,
    shakeSpeed: 15.0
  },
  render: {
    pixelRatioCap: 2,
    fogColor: '#07070a',
    fogDensity: 0.002,
    skyTop: '#050508',
    skyMid: '#12121c',
    skyBot: '#2a2a35',
    roadColor: '#1e1e20',
    roadLineColor: '#ffcc00',
    grassColor: '#0f140f',
    maxParticles: 300,
    particleSpawnRate: 0.4
  },
  cars: [
    {
      id: 'm5',
      name: 'BMW M5',
      description: 'AWD High-Performance Sedan',
      power: 4500,
      maxTorque: 750,
      mass: 1900,
      drive: 'AWD',
      color: '#1a2338',
      accentColor: '#4a7eb8',
      length: 4.6,
      width: 1.9,
      height: 1.4,
      wheelBase: 2.9,
      trackWidth: 1.6,
      topSpeed: 72,
      gearRatios: [3.4, 2.3, 1.7, 1.3, 1.0, 0.8],
      suspensionStiffness: 32,
      downforce: 0.35
    },
    {
      id: 'mustang',
      name: 'Mustang 1969',
      description: 'Classic RWD Muscle Car',
      power: 3800,
      maxTorque: 600,
      mass: 1550,
      drive: 'RWD',
      color: '#7a1c1c',
      accentColor: '#d4af37',
      length: 4.7,
      width: 1.9,
      height: 1.3,
      wheelBase: 2.75,
      trackWidth: 1.6,
      topSpeed: 62,
      gearRatios: [2.9, 1.9, 1.35, 1.0, 0.78, 0.62],
      suspensionStiffness: 28,
      downforce: 0.2
    },
    {
      id: 'porsche',
      name: 'Porsche 911',
      description: 'Lightweight Balanced Sports Car',
      power: 4200,
      maxTorque: 700,
      mass: 1420,
      drive: 'RWD',
      color: '#2c2c2c',
      accentColor: '#cc0000',
      length: 4.4,
      width: 1.85,
      height: 1.25,
      wheelBase: 2.45,
      trackWidth: 1.55,
      topSpeed: 76,
      gearRatios: [3.1, 2.0, 1.45, 1.05, 0.82, 0.66],
      suspensionStiffness: 35,
      downforce: 0.45
    },
    {
      id: 'ferrari',
      name: 'LaFerrari',
      description: 'Extreme Hypercar',
      power: 5500,
      maxTorque: 900,
      mass: 1350,
      drive: 'RWD',
      color: '#b81414',
      accentColor: '#ffcc00',
      length: 4.7,
      width: 1.95,
      height: 1.15,
      wheelBase: 2.65,
      trackWidth: 1.65,
      topSpeed: 92,
      gearRatios: [3.6, 2.3, 1.65, 1.25, 0.95, 0.7],
      suspensionStiffness: 40,
      downforce: 0.7
    }
  ]
};

// ----------------------------------------------------------------------------
// SECTION 2: MATH UTILITIES AND HELPERS
// ----------------------------------------------------------------------------
const MathHelper = {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  lerp: (start, end, amount) => start + (end - start) * amount,
  inverseLerp: (start, end, value) => (value - start) / (end - start),
  smoothstep: (edge0, edge1, x) => {
    const t = MathHelper.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },
  toRadians: (degrees) => degrees * (Math.PI / 180),
  toDegrees: (radians) => radians * (180 / Math.PI),
  randomRange: (min, max) => Math.random() * (max - min) + min,
  randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  distance: (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
  isFiniteSafe: (val, fallback = 0) => (isFinite(val) && !isNaN(val)) ? val : fallback
};

// ----------------------------------------------------------------------------
// SECTION 3: DOM ELEMENTS CACHE
// ----------------------------------------------------------------------------
const DOM_CACHE = {
  portraitBlocker: document.getElementById('portrait-blocker'),
  loadingScreen: document.getElementById('loading-screen'),
  loadBar: document.getElementById('load-bar'),
  loadPct: document.getElementById('load-pct'),
  loadStatus: document.getElementById('load-status'),
  gameStage: document.getElementById('game-stage'),
  canvas: document.getElementById('game-canvas'),
  menuScreen: document.getElementById('menu-screen'),
  menuCarList: document.getElementById('menu-car-list'),
  btnStartGame: document.getElementById('btn-start-game'),
  hudLayer: document.getElementById('hud-layer'),
  hudCarName: document.getElementById('hud-car-name-display'),
  hudTransmission: document.getElementById('hud-transmission-display'),
  hudSpeedValue: document.getElementById('hud-speed-value'),
  hudGearValue: document.getElementById('hud-gear-value'),
  hudSpeedArc: document.getElementById('hud-speed-arc'),
  btnBackToMenu: document.getElementById('btn-back-to-menu'),
  btnSteerLeft: document.getElementById('btn-steer-left'),
  btnSteerRight: document.getElementById('btn-steer-right'),
  btnPedalGas: document.getElementById('btn-pedal-gas'),
  btnPedalBrake: document.getElementById('btn-pedal-brake'),
  btnShiftUp: document.getElementById('btn-shift-up'),
  btnShiftDown: document.getElementById('btn-shift-down')
};

// ----------------------------------------------------------------------------
// SECTION 4: GLOBAL STATE MANAGER
// ----------------------------------------------------------------------------
const GLOBAL_STATE = {
  appState: 'LOADING', // LOADING, MENU, DRIVING, PAUSED
  selectedCarIndex: 0,
  
  // Vehicle Dynamics
  speed: 0,
  rpm: 900,
  gear: 1,
  throttle: 0,
  brake: 0,
  steer: 0,
  
  // World State
  distance: 0,
  timeElapsed: 0,
  wheelSpin: 0,
  cameraShake: 0,
  
  // Transmission
  isManual: false,
  shiftCooldown: 0,
  
  // Collections
  particles: [],
  trafficCars: [],
  
  // Inputs
  inputs: {
    gas: false,
    brake: false,
    left: false,
    right: false
  },
  
  // Timing
  lastFrameTime: performance.now(),
  physicsAccumulator: 0
};

// ----------------------------------------------------------------------------
// SECTION 5: PROCEDURAL AUDIO ENGINE
// ----------------------------------------------------------------------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filter = null;
    this.oscillators = [];
    this.isInitialized = false;
    this.isMuted = false;
  }

  initialize() {
    if (this.isInitialized) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      
      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0; // Start silent
      this.masterGain.connect(this.ctx.destination);

      // Dynamic Lowpass Filter
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 500;
      this.filter.Q.value = 3;
      this.filter.connect(this.masterGain);

      // Create Oscillators (Engine tone simulation)
      const oscConfigs = [
        { type: 'sawtooth', freq: 40, gain: 0.4 },
        { type: 'square', freq: 80, gain: 0.2 },
        { type: 'sawtooth', freq: 20, gain: 0.5 }
      ];

      oscConfigs.forEach(cfg => {
        const osc = this.ctx.createOscillator();
        osc.type = cfg.type;
        osc.frequency.value = cfg.freq;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = cfg.gain;

        osc.connect(gainNode);
        gainNode.connect(this.filter);
        
        osc.start();
        this.oscillators.push(osc);
      });

      this.isInitialized = true;
      console.log("[AUDIO] Sound engine initialized.");
    } catch (e) {
      console.warn("[AUDIO] Web Audio API not supported.", e);
    }
  }

  update(rpm, throttle, speed) {
    if (!this.isInitialized || this.isMuted) return;

    // Guard against NaN/Infinity
    const safeRpm = MathHelper.isFiniteSafe(rpm, 900);
    const safeThrottle = MathHelper.isFiniteSafe(throttle, 0);
    const safeSpeed = MathHelper.isFiniteSafe(speed, 0);

    const clampedRpm = MathHelper.clamp(safeRpm, 900, 8000);
    const clampedThrottle = MathHelper.clamp(safeThrottle, 0, 1);
    
    const now = this.ctx.currentTime;
    const baseFreq = 35 + (clampedRpm / 8000) * 180;

    this.oscillators[0].frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.oscillators[1].frequency.setTargetAtTime(baseFreq * 2.02, now, 0.05);
    this.oscillators[2].frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    // Filter frequency based on throttle and RPM
    const filterFreq = 300 + clampedThrottle * 1500 + (clampedRpm / 8000) * 1000;
    this.filter.frequency.setTargetAtTime(MathHelper.clamp(filterFreq, 200, 6000), now, 0.1);

    // Volume based on throttle and speed
    const targetVol = 0.05 + clampedThrottle * 0.15 + (safeSpeed / 100) * 0.05;
    this.masterGain.gain.setTargetAtTime(MathHelper.clamp(targetVol, 0, 0.3), now, 0.1);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.15, this.ctx.currentTime, 0.1);
    }
  }
}

const AudioEngine = new SoundEngine();

// ----------------------------------------------------------------------------
// SECTION 6: RENDERER AND CANVAS MANAGER
// ----------------------------------------------------------------------------
class Renderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, ENGINE_CONFIG.render.pixelRatioCap);
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const isPortrait = window.innerHeight > window.innerWidth;
    this.width = isPortrait ? window.innerHeight : window.innerWidth;
    this.height = isPortrait ? window.innerWidth : window.innerHeight;
    
    this.canvas.width = this.width * this.pixelRatio;
    this.canvas.height = this.height * this.pixelRatio;
    
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    
    // Re-adjust canvas CSS to match forced landscape
    if (isPortrait) {
      this.canvas.style.width = `${this.height}px`;
      this.canvas.style.height = `${this.width}px`;
    } else {
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

const GameRenderer = new Renderer('game-canvas');

// ----------------------------------------------------------------------------
// SECTION 7: SCENE RENDERING (PSEUDO-3D)
// ----------------------------------------------------------------------------
function renderSky() {
  const ctx = GameRenderer.ctx;
  const w = GameRenderer.width;
  const h = GameRenderer.height;

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, ENGINE_CONFIG.render.skyTop);
  gradient.addColorStop(0.4, ENGINE_CONFIG.render.skyMid);
  gradient.addColorStop(1, ENGINE_CONFIG.render.skyBot);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function renderRoad() {
  const ctx = GameRenderer.ctx;
  const w = GameRenderer.width;
  const h = GameRenderer.height;
  
  const horizon = h * 0.45;
  const roadWidthTop = w * 0.04;
  const roadWidthBot = w * 1.8;
  const centerX = w / 2;

  // Draw Grass
  ctx.fillStyle = ENGINE_CONFIG.render.grassColor;
  
  // Left grass
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(centerX - roadWidthTop, horizon);
  ctx.lineTo(centerX - roadWidthBot, h);
  ctx.lineTo(0, h);
  ctx.fill();
  
  // Right grass
  ctx.beginPath();
  ctx.moveTo(w, horizon);
  ctx.lineTo(centerX + roadWidthTop, horizon);
  ctx.lineTo(centerX + roadWidthBot, h);
  ctx.lineTo(w, h);
  ctx.fill();

  // Draw Road Base
  ctx.fillStyle = ENGINE_CONFIG.render.roadColor;
  ctx.beginPath();
  ctx.moveTo(centerX - roadWidthTop, horizon);
  ctx.lineTo(centerX + roadWidthTop, horizon);
  ctx.lineTo(centerX + roadWidthBot, h);
  ctx.lineTo(centerX - roadWidthBot, h);
  ctx.fill();

  // Draw Road Edge Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 3;
  
  // Left edge
  ctx.beginPath();
  ctx.moveTo(centerX - roadWidthTop + 8, horizon);
  ctx.lineTo(centerX - roadWidthBot + (w * 0.1), h);
  ctx.stroke();
  
  // Right edge
  ctx.beginPath();
  ctx.moveTo(centerX + roadWidthTop - 8, horizon);
  ctx.lineTo(centerX + roadWidthBot - (w * 0.1), h);
  ctx.stroke();

  // Draw Center Dashes
  ctx.strokeStyle = ENGINE_CONFIG.render.roadLineColor;
  const dashCount = 25;
  const scrollOffset = (GLOBAL_STATE.distance * 3) % 1;
  
  for (let i = 0; i < dashCount; i++) {
    const t1 = (i + scrollOffset) / dashCount;
    const t2 = (i + 0.35 + scrollOffset) / dashCount;
    
    if (t2 > 1) continue;
    
    const y1 = horizon + (h - horizon) * Math.pow(t1, 2);
    const y2 = horizon + (h - horizon) * Math.pow(t2, 2);
    
    ctx.lineWidth = 1 + (t1 * 8);
    ctx.beginPath();
    ctx.moveTo(centerX, y1);
    ctx.lineTo(centerX, y2);
    ctx.stroke();
  }
}

function renderTraffic() {
  const ctx = GameRenderer.ctx;
  const w = GameRenderer.width;
  const h = GameRenderer.height;
  const horizon = h * 0.45;
  
  // Draw simple boxes for traffic cars to simulate depth
  GLOBAL_STATE.trafficCars.forEach(car => {
    // Map Z depth to screen Y
    const depthRatio = MathHelper.clamp(car.z / 1000, 0, 1);
    const y = horizon + (h - horizon) * Math.pow(depthRatio, 2);
    
    // Map X offset to screen X
    const scale = 0.1 + depthRatio * 0.9;
    const x = (w / 2) + (car.x * w * 0.4);
    
    const carW = w * 0.1 * scale;
    const carH = carW * 0.5;
    
    ctx.fillStyle = car.color;
    ctx.fillRect(x - carW/2, y - carH, carW, carH);
    
    // Taillights
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x - carW*0.4, y - carH*0.6, carW*0.2, carH*0.2);
    ctx.fillRect(x + carW*0.2, y - carH*0.6, carW*0.2, carH*0.2);
  });
}

function renderPlayerCar() {
  const ctx = GameRenderer.ctx;
  const w = GameRenderer.width;
  const h = GameRenderer.height;
  
  const carSpec = ENGINE_CONFIG.cars[GLOBAL_STATE.selectedCarIndex];
  
  const carW = w * 0.28;
  const carH = carW * 0.42;
  
  // Add slight sway based on steering
  const sway = GLOBAL_STATE.steer * -25;
  const cx = (w / 2) + sway;
  const cy = h - carH - 40;

  // Camera Shake
  const shakeX = (Math.random() - 0.5) * GLOBAL_STATE.cameraShake;
  const shakeY = (Math.random() - 0.5) * GLOBAL_STATE.cameraShake;
  
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Car Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + carH - 5, carW * 0.55, carH * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Car Chassis
  ctx.fillStyle = carSpec.color;
  ctx.beginPath();
  ctx.moveTo(cx - carW/2, cy + carH/2);
  ctx.lineTo(cx - carW/2 + 15, cy);
  ctx.lineTo(cx + carW/2 - 15, cy);
  ctx.lineTo(cx + carW/2, cy + carH/2);
  ctx.lineTo(cx + carW/2 - 10, cy + carH);
  ctx.lineTo(cx - carW/2 + 10, cy + carH);
  ctx.fill();

  // Accent Stripe
  ctx.fillStyle = carSpec.accentColor;
  ctx.fillRect(cx - carW*0.05, cy + 5, carW*0.1, carH*0.8);

  // Windshield
  ctx.fillStyle = '#050508';
  ctx.beginPath();
  ctx.moveTo(cx - carW*0.3, cy + 8);
  ctx.lineTo(cx + carW*0.3, cy + 8);
  ctx.lineTo(cx + carW*0.4, cy + carH*0.5);
  ctx.lineTo(cx - carW*0.4, cy + carH*0.5);
  ctx.fill();

  // Glowing Taillights
  ctx.fillStyle = '#ff1111';
  ctx.shadowColor = '#ff1111';
  ctx.shadowBlur = 15;
  ctx.fillRect(cx - carW*0.45, cy + carH*0.6, carW*0.15, carH*0.2);
  ctx.fillRect(cx + carW*0.3, cy + carH*0.6, carW*0.15, carH*0.2);
  ctx.shadowBlur = 0;

  // Wheels
  const wheelW = carW * 0.15;
  const wheelH = carH * 0.4;
  ctx.fillStyle = '#050505';
  
  const spin = GLOBAL_STATE.wheelSpin * 5;
  
  const drawWheel = (wx) => {
    ctx.fillRect(wx, cy + carH*0.55, wheelW, wheelH);
    
    // Spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      wx + wheelW/2 - Math.cos(spin) * wheelW * 0.3, 
      cy + carH*0.55 + wheelH/2 - Math.sin(spin) * wheelH * 0.3
    );
    ctx.lineTo(
      wx + wheelW/2 + Math.cos(spin) * wheelW * 0.3, 
      cy + carH*0.55 + wheelH/2 + Math.sin(spin) * wheelH * 0.3
    );
    ctx.stroke();
  };

  drawWheel(cx - carW/2 - 2);
  drawWheel(cx + carW/2 - wheelW + 2);

  ctx.restore();
}

function renderParticles() {
  const ctx = GameRenderer.ctx;
  
  for (let i = GLOBAL_STATE.particles.length - 1; i >= 0; i--) {
    const p = GLOBAL_STATE.particles[i];
    
    p.life -= 0.02;
    p.y -= p.speed;
    p.x += p.drift;
    
    if (p.life <= 0) {
      GLOBAL_STATE.particles.splice(i, 1);
      continue;
    }
    
    ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderScene() {
  GameRenderer.clear();
  
  renderSky();
  renderRoad();
  renderTraffic();
  renderParticles();
  renderPlayerCar();
}

// ----------------------------------------------------------------------------
// SECTION 8: TRAFFIC AI AND SPAWNING
// ----------------------------------------------------------------------------
function updateTraffic(dt) {
  const w = GameRenderer.width;
  
  // Spawn logic
  if (Math.random() < 0.02 && GLOBAL_STATE.trafficCars.length < 10) {
    GLOBAL_STATE.trafficCars.push({
      z: 1000,
      x: MathHelper.randomRange(-1.5, 1.5), // Lateral offset
      speed: MathHelper.randomRange(10, 25),
      color: `hsl(${MathHelper.randomInt(0, 360)}, 50%, 40%)`
    });
  }

  // Move and remove
  for (let i = GLOBAL_STATE.trafficCars.length - 1; i >= 0; i--) {
    const car = GLOBAL_STATE.trafficCars[i];
    
    // Relative speed (player moves faster, so traffic z decreases)
    car.z -= (GLOBAL_STATE.speed - car.speed) * dt * 10;
    
    // Remove if behind player
    if (car.z < 0) {
      GLOBAL_STATE.trafficCars.splice(i, 1);
    }
  }
}

// ----------------------------------------------------------------------------
// SECTION 9: PHYSICS SIMULATION
// ----------------------------------------------------------------------------
function updateVehiclePhysics(dt) {
  const carSpec = ENGINE_CONFIG.cars[GLOBAL_STATE.selectedCarIndex];
  
  // 1. Inputs
  GLOBAL_STATE.throttle = GLOBAL_STATE.inputs.gas ? 1 : 0;
  GLOBAL_STATE.brake = GLOBAL_STATE.inputs.brake ? 1 : 0;
  
  // 2. Steering
  const steerTarget = (GLOBAL_STATE.inputs.left ? 1 : 0) - (GLOBAL_STATE.inputs.right ? 1 : 0);
  GLOBAL_STATE.steer += (steerTarget - GLOBAL_STATE.steer) * 8 * dt;
  
  // 3. Gear Ratios & Torque
  const currentRatio = carSpec.gearRatios[Math.min(GLOBAL_STATE.gear - 1, carSpec.gearRatios.length - 1)];
  const engineTorque = GLOBAL_STATE.throttle * (carSpec.maxTorque * currentRatio);
  
  // 4. Forces
  const driveForce = engineTorque * 0.05; 
  const brakeForce = GLOBAL_STATE.brake * 2500;
  const dragForce = Math.pow(GLOBAL_STATE.speed, 2) * ENGINE_CONFIG.physics.dragCoefficient * 0.1;
  const rollingResistance = GLOBAL_STATE.speed * ENGINE_CONFIG.physics.rollingResistance * 50;
  
  // 5. Update Speed
  const netForce = driveForce - brakeForce - dragForce - rollingResistance;
  GLOBAL_STATE.speed += (netForce / carSpec.mass) * dt * 60;
  
  GLOBAL_STATE.speed = MathHelper.clamp(GLOBAL_STATE.speed, 0, carSpec.topSpeed);
  
  // 6. Update Distance
  GLOBAL_STATE.distance += GLOBAL_STATE.speed * dt;
  
  // 7. Wheel Spin
  GLOBAL_STATE.wheelSpin += (GLOBAL_STATE.speed * 0.8) * dt;
  
  // 8. RPM Calculation
  const targetRpm = 900 + (GLOBAL_STATE.speed / carSpec.topSpeed) * 7000;
  GLOBAL_STATE.rpm += (targetRpm - GLOBAL_STATE.rpm) * 5 * dt;
  
  // 9. Automatic Transmission
  if (!GLOBAL_STATE.isManual && GLOBAL_STATE.shiftCooldown <= 0) {
    if (GLOBAL_STATE.rpm > 6500 && GLOBAL_STATE.gear < 6) {
      GLOBAL_STATE.gear++;
      GLOBAL_STATE.shiftCooldown = 0.5;
      updateHUDGear();
    }
    if (GLOBAL_STATE.rpm < 3000 && GLOBAL_STATE.gear > 1) {
      GLOBAL_STATE.gear--;
      GLOBAL_STATE.shiftCooldown = 0.5;
      updateHUDGear();
    }
  }
  
  if (GLOBAL_STATE.shiftCooldown > 0) {
    GLOBAL_STATE.shiftCooldown -= dt;
  }

  // 10. Camera Shake
  GLOBAL_STATE.cameraShake = (GLOBAL_STATE.speed / carSpec.topSpeed) * ENGINE_CONFIG.camera.shakeIntensity * 10;

  // 11. Particles (Exhaust/Tire Smoke)
  if (GLOBAL_STATE.throttle > 0 && Math.random() > 0.4) {
    GLOBAL_STATE.particles.push({
      x: (GameRenderer.width / 2) + (GLOBAL_STATE.steer * -25) + MathHelper.randomRange(-20, 20),
      y: GameRenderer.height - 80,
      size: MathHelper.randomRange(5, 12),
      life: 1.0,
      speed: MathHelper.randomRange(2, 5),
      drift: MathHelper.randomRange(-1, 1)
    });
  }
}

// ----------------------------------------------------------------------------
// SECTION 10: UI UPDATES
// ----------------------------------------------------------------------------
function updateHUDSpeed() {
  const kmh = Math.round(GLOBAL_STATE.speed * 3.6);
  const safeKmh = MathHelper.isFiniteSafe(kmh, 0);
  
  DOM_CACHE.hudSpeedValue.textContent = safeKmh;
  
  const maxDisplay = 300;
  const ratio = MathHelper.clamp(safeKmh / maxDisplay, 0, 1);
  const arcLength = 298;
  
  DOM_CACHE.hudSpeedArc.setAttribute('stroke-dasharray', `${ratio * arcLength} ${arcLength}`);
}

function updateHUDGear() {
  DOM_CACHE.hudGearValue.textContent = GLOBAL_STATE.gear;
  
  if (GLOBAL_STATE.isManual) {
    DOM_CACHE.hudTransmission.textContent = 'MANUAL';
  } else {
    DOM_CACHE.hudTransmission.textContent = 'AUTOMATIC';
  }
}

// ----------------------------------------------------------------------------
// SECTION 11: INPUT HANDLERS
// ----------------------------------------------------------------------------
function setupInputBindings() {
  const bindHold = (element, onDown, onUp) => {
    const start = (e) => {
      e.preventDefault();
      element.classList.add('pressed');
      onDown();
      AudioEngine.resume();
    };
    
    const end = (e) => {
      e.preventDefault();
      element.classList.remove('pressed');
      onUp();
    };
    
    element.addEventListener('pointerdown', start);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('pointerleave', end);
    element.addEventListener('contextmenu', e => e.preventDefault());
  };

  // Steering
  bindHold(DOM_CACHE.btnSteerLeft, () => GLOBAL_STATE.inputs.left = true, () => GLOBAL_STATE.inputs.left = false);
  bindHold(DOM_CACHE.btnSteerRight, () => GLOBAL_STATE.inputs.right = true, () => GLOBAL_STATE.inputs.right = false);
  
  // Pedals
  bindHold(DOM_CACHE.btnPedalGas, () => GLOBAL_STATE.inputs.gas = true, () => GLOBAL_STATE.inputs.gas = false);
  bindHold(DOM_CACHE.btnPedalBrake, () => GLOBAL_STATE.inputs.brake = true, () => GLOBAL_STATE.inputs.brake = false);

  // Paddle Shifters (Manual Override)
  DOM_CACHE.btnShiftUp.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (GLOBAL_STATE.appState === 'DRIVING' && GLOBAL_STATE.gear < 6) {
      GLOBAL_STATE.isManual = true;
      GLOBAL_STATE.gear++;
      updateHUDGear();
    }
  });

  DOM_CACHE.btnShiftDown.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (GLOBAL_STATE.appState === 'DRIVING' && GLOBAL_STATE.gear > 1) {
      GLOBAL_STATE.isManual = true;
      GLOBAL_STATE.gear--;
      updateHUDGear();
    }
  });

  // Keyboard Fallback (PC Testing)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowUp' || e.key === 'w') GLOBAL_STATE.inputs.gas = true;
    if (e.key === 'ArrowDown' || e.key === 's') GLOBAL_STATE.inputs.brake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') GLOBAL_STATE.inputs.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') GLOBAL_STATE.inputs.right = true;
    
    if (e.key === 'Shift') {
      GLOBAL_STATE.isManual = true;
      GLOBAL_STATE.gear = Math.min(GLOBAL_STATE.gear + 1, 6);
      updateHUDGear();
    }
    if (e.key === 'Control') {
      GLOBAL_STATE.isManual = true;
      GLOBAL_STATE.gear = Math.max(GLOBAL_STATE.gear - 1, 1);
      updateHUDGear();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') GLOBAL_STATE.inputs.gas = false;
    if (e.key === 'ArrowDown' || e.key === 's') GLOBAL_STATE.inputs.brake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') GLOBAL_STATE.inputs.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') GLOBAL_STATE.inputs.right = false;
  });
}

// ----------------------------------------------------------------------------
// SECTION 12: SCREEN MANAGEMENT AND FLOW
// ----------------------------------------------------------------------------
const SVG_TEMPLATES = {
  m5: `<svg viewBox="0 0 150 60"><path d="M 20 45 L 30 25 L 120 25 L 130 45 Z" /><circle cx="40" cy="47" r="8"/><circle cx="110" cy="47" r="8"/></svg>`,
  mustang: `<svg viewBox="0 0 150 60"><path d="M 15 45 L 25 20 L 125 20 L 135 45 Z" /><circle cx="35" cy="47" r="8"/><circle cx="115" cy="47" r="8"/></svg>`,
  porsche: `<svg viewBox="0 0 150 60"><path d="M 25 45 L 35 28 L 115 28 L 125 45 Z" /><circle cx="45" cy="47" r="8"/><circle cx="105" cy="47" r="8"/></svg>`,
  ferrari: `<svg viewBox="0 0 150 60"><path d="M 20 45 L 28 18 L 122 18 L 130 45 Z" /><circle cx="40" cy="47" r="8"/><circle cx="110" cy="47" r="8"/></svg>`
};

function buildMenuScreen() {
  DOM_CACHE.menuCarList.innerHTML = '';
  
  ENGINE_CONFIG.cars.forEach((car, index) => {
    const card = document.createElement('div');
    card.className = `car-card ${index === 0 ? 'active' : ''}`;
    
    card.innerHTML = `
      <div class="car-card-visual">
        ${SVG_TEMPLATES[car.id]}
      </div>
      <div class="car-card-info">
        <h3>${car.name}</h3>
        <div class="car-card-specs">
          <div class="spec-item">
            <span class="spec-label">DRIVE</span>
            <span class="spec-value">${car.drive}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">POWER</span>
            <span class="spec-value">${car.power} hp</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">TORQUE</span>
            <span class="spec-value">${car.maxTorque} Nm</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">WEIGHT</span>
            <span class="spec-value">${car.mass} kg</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      document.querySelectorAll('.car-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      GLOBAL_STATE.selectedCarIndex = index;
      AudioEngine.initialize();
      AudioEngine.resume();
    });

    DOM_CACHE.menuCarList.appendChild(card);
  });
}

function transitionToDriving() {
  // Force fullscreen
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

  // UI Transitions
  DOM_CACHE.menuScreen.classList.add('hidden');
  DOM_CACHE.hudLayer.classList.remove('hidden');
  DOM_CACHE.hudLayer.classList.add('visible');

  // Initialization
  AudioEngine.initialize();
  AudioEngine.resume();

  GLOBAL_STATE.appState = 'DRIVING';
  GLOBAL_STATE.speed = 0;
  GLOBAL_STATE.rpm = 900;
  GLOBAL_STATE.gear = 1;
  GLOBAL_STATE.steer = 0;
  GLOBAL_STATE.distance = 0;
  GLOBAL_STATE.isManual = false;
  GLOBAL_STATE.particles = [];
  GLOBAL_STATE.trafficCars = [];
  GLOBAL_STATE.inputs = { gas: false, brake: false, left: false, right: false };

  const carSpec = ENGINE_CONFIG.cars[GLOBAL_STATE.selectedCarIndex];
  DOM_CACHE.hudCarName.textContent = carSpec.name;
  
  updateHUDGear();
  updateHUDSpeed();
  
  GLOBAL_STATE.lastFrameTime = performance.now();
  GLOBAL_STATE.physicsAccumulator = 0;
}

function transitionToMenu() {
  GLOBAL_STATE.appState = 'MENU';
  AudioEngine.setMute(true);
  
  DOM_CACHE.hudLayer.classList.add('hidden');
  DOM_CACHE.hudLayer.classList.remove('visible');
  DOM_CACHE.menuScreen.classList.remove('hidden');
}

// ----------------------------------------------------------------------------
// SECTION 13: CORE GAME LOOP
// ----------------------------------------------------------------------------
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  let dt = (timestamp - GLOBAL_STATE.lastFrameTime) / 1000;
  GLOBAL_STATE.lastFrameTime = timestamp;

  // Guard against NaN or massive frame drops
  if (!isFinite(dt) || dt > 0.2) dt = 0.016;
  if (dt <= 0) dt = 0.016;

  if (GLOBAL_STATE.appState === 'DRIVING') {
    GLOBAL_STATE.physicsAccumulator += dt;
    let steps = 0;

    while (GLOBAL_STATE.physicsAccumulator >= ENGINE_CONFIG.physics.fixedTimeStep && steps < ENGINE_CONFIG.physics.maxSubSteps) {
      updateVehiclePhysics(ENGINE_CONFIG.physics.fixedTimeStep);
      updateTraffic(ENGINE_CONFIG.physics.fixedTimeStep);
      GLOBAL_STATE.physicsAccumulator -= ENGINE_CONFIG.physics.fixedTimeStep;
      steps++;
    }

    if (steps >= ENGINE_CONFIG.physics.maxSubSteps) {
      GLOBAL_STATE.physicsAccumulator = 0;
    }

    GLOBAL_STATE.timeElapsed += dt;
    
    // Update Audio
    AudioEngine.update(GLOBAL_STATE.rpm, GLOBAL_STATE.throttle, GLOBAL_STATE.speed);
    
    // Update HUD
    updateHUDSpeed();
  }

  // Render scene (always render, even if paused/menu, to prevent flashing)
  renderScene();
}

// ----------------------------------------------------------------------------
// SECTION 14: INITIALIZATION AND BOOTSTRAP
// ----------------------------------------------------------------------------
function handleOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  DOM_CACHE.portraitBlocker.classList.toggle('visible', isPortrait);
}

function boot() {
  console.log("[BOOT] Starting Apex Drive initialization sequence...");

  // Event Listeners
  window.addEventListener('resize', handleOrientation);
  handleOrientation();

  DOM_CACHE.btnStartGame.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    transitionToDriving();
  });

  DOM_CACHE.btnBackToMenu.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    transitionToMenu();
  });

  buildMenuScreen();
  setupInputBindings();

  // Simulated Loading Sequence
  let progress = 0;
  const loadingInterval = setInterval(() => {
    progress += MathHelper.randomRange(5, 15);
    
    if (progress > 100) progress = 100;
    
    DOM_CACHE.loadBar.style.width = `${progress}%`;
    DOM_CACHE.loadPct.textContent = `${Math.floor(progress)}%`;
    
    if (progress > 20) DOM_CACHE.loadStatus.textContent = "Loading track data...";
    if (progress > 50) DOM_CACHE.loadStatus.textContent = "Initializing physics engine...";
    if (progress > 80) DOM_CACHE.loadStatus.textContent = "Warming up tires...";
    
    if (progress >= 100) {
      DOM_CACHE.loadStatus.textContent = "Ready.";
      clearInterval(loadingInterval);
      
      setTimeout(() => {
        DOM_CACHE.loadingScreen.classList.add('hidden');
        DOM_CACHE.menuScreen.classList.remove('hidden');
        
        GLOBAL_STATE.appState = 'MENU';
        GLOBAL_STATE.lastFrameTime = performance.now();
        
        // Start main loop
        requestAnimationFrame(gameLoop);
        
        console.log("[BOOT] Initialization complete. Engine running.");
      }, 500);
    }
  }, 100);
}

// Fire when window is ready
window.addEventListener('load', boot);