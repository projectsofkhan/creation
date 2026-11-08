import * as THREE from 'three';
import { WORLD_SIZE, HALF_WORLD, GRID_SIZE, CELL_SIZE, HALF_GRID, terrainHeight, progress } from './script.js';

// ═══════════════════════════════════════════════════════════════
//  MATERIALS & TEXTURES
// ═══════════════════════════════════════════════════════════════

export function makeSoilTexture(moisture = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const base = moisture > 0.5 ? [52, 34, 18] : [88, 60, 34];
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, 256, 256);

  // Grain noise
  for (let i = 0; i < 8000; i++) {
    const v = Math.random() * 50 - 25;
    ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v * 0.8},${base[2] + v * 0.5},0.85)`;
    const s = 1 + Math.random() * 2;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }

  // Fine speckle
  for (let i = 0; i < 3000; i++) {
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? 'rgba(180,140,90,0.25)' : 'rgba(20,12,6,0.3)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }

  // Tilled furrows (only for non-grass)
  if (moisture >= 0.1) {
    ctx.strokeStyle = moisture > 0.5 ? 'rgba(20,12,6,0.75)' : 'rgba(30,20,12,0.65)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let y = 12; y < 256; y += 28) {
      ctx.beginPath();
      for (let x = 0; x < 256; x += 6) {
        ctx.lineTo(x, y + Math.sin(x * 0.12) * 2.2);
      }
      ctx.stroke();
    }
    // Highlight the ridges
    ctx.strokeStyle = moisture > 0.5 ? 'rgba(100,70,40,0.4)' : 'rgba(130,90,50,0.55)';
    ctx.lineWidth = 2;
    for (let y = 12; y < 256; y += 28) {
      ctx.beginPath();
      for (let x = 0; x < 256; x += 6) {
        ctx.lineTo(x, y + Math.sin(x * 0.12) * 2.2 - 3);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ═══════════════════════════════════════════════════════════════
//  TOOLS (held in player's right hand)
// ═══════════════════════════════════════════════════════════════

export const TOOL_DEFS = [
  { icon: '⛏️', label: 'Hoe' },
  { icon: '💧', label: 'Water' },
  { icon: '🌱', label: 'Seed' },
  { icon: '🧺', label: 'Pick' },
  { icon: '🏪', label: 'Shop' },
];

export function createHoe() {
  const g = new THREE.Group();

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.88, metalness: 0.02 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x9a9aac, roughness: 0.4, metalness: 0.82 });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.25, 8), handleMat);
  handle.position.y = -0.55;
  handle.rotation.x = 0.35;
  handle.castShadow = true;
  g.add(handle);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.18), metalMat);
  blade.position.set(0, -1.16, 0.23);
  blade.rotation.x = 0.35;
  blade.castShadow = true;
  g.add(blade);

  return g;
}

export function createWateringCan() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a8a9a, metalness: 0.55, roughness: 0.45 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.28, 12), mat);
  body.position.y = -0.9;
  body.castShadow = true;
  g.add(body);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 16), mat);
  handle.position.set(0, -0.78, -0.05);
  handle.rotation.x = Math.PI / 2;
  g.add(handle);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.055, 0.36, 8), mat);
  spout.position.set(0.15, -0.85, 0.12);
  spout.rotation.z = -0.55;
  spout.castShadow = true;
  g.add(spout);

  return g;
}

export function createSeedPouch() {
  const g = new THREE.Group();
  const pouch = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.95 })
  );
  pouch.position.y = -0.9;
  pouch.scale.set(1, 0.85, 1);
  pouch.castShadow = true;
  g.add(pouch);

  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.015, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.9 })
  );
  tie.position.y = -0.78;
  tie.rotation.x = Math.PI / 2;
  g.add(tie);

  return g;
}

export function createBasket() {
  const g = new THREE.Group();
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.13, 0.24, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xb08a50, side: THREE.DoubleSide, roughness: 0.92 })
  );
  basket.position.y = -0.9;
  basket.castShadow = true;
  g.add(basket);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.02, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.9 })
  );
  rim.position.y = -0.78;
  rim.rotation.x = Math.PI / 2;
  g.add(rim);

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  CROPS (tomato plant growth stages)
// ═══════════════════════════════════════════════════════════════

const sproutMat = new THREE.MeshStandardMaterial({ color: 0x6aab4a, roughness: 0.75 });
const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a9b3a, roughness: 0.82 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x5abb4a, roughness: 0.8 });
const fruitRipeMat = new THREE.MeshStandardMaterial({
  color: 0xe83a2a, roughness: 0.35, metalness: 0.05,
  emissive: 0x220000, emissiveIntensity: 0.25,
});
const fruitGreenMat = new THREE.MeshStandardMaterial({ color: 0x7abc4a, roughness: 0.55 });

export const CROP_STAGES = [
  { name: 'sprout', min: 0.0, max: 0.25 },
  { name: 'young', min: 0.25, max: 0.6 },
  { name: 'flowering', min: 0.6, max: 0.9 },
  { name: 'ripe', min: 0.9, max: 1.01 },
];

export function createCropMesh(growth) {
  const g = new THREE.Group();

  if (growth < 0.25) {
    // Sprout: two tiny leaves
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), sproutMat);
    sp.position.y = 0.1;
    sp.scale.set(1.3, 0.5, 1.3);
    sp.castShadow = true;
    g.add(sp);

    for (let i = 0; i < 2; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), leafMat);
      const a = i * Math.PI;
      l.position.set(Math.cos(a) * 0.13, 0.14, Math.sin(a) * 0.13);
      l.scale.set(1.4, 0.3, 0.8);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
  } else if (growth < 0.6) {
    // Young plant: stem + leaves
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.9, 6), stemMat);
    stem.position.y = 0.45;
    stem.castShadow = true;
    g.add(stem);

    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), leafMat);
      l.scale.set(1.5, 0.35, 1);
      const a = i * 1.6;
      l.position.set(Math.cos(a) * 0.26, 0.4 + i * 0.13, Math.sin(a) * 0.26);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }
  } else {
    // Flowering / ripe
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 1.25, 6), stemMat);
    stem.position.y = 0.62;
    stem.castShadow = true;
    g.add(stem);

    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), leafMat);
      l.scale.set(1.6, 0.35, 1);
      const a = i * 1.05;
      l.position.set(Math.cos(a) * 0.38, 0.3 + i * 0.15, Math.sin(a) * 0.38);
      l.rotation.y = a;
      l.castShadow = true;
      g.add(l);
    }

    const ripe = growth >= 0.9;
    const count = ripe ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(ripe ? 0.18 : 0.1, ripe ? 10 : 6, ripe ? 8 : 5),
        ripe ? fruitRipeMat : fruitGreenMat
      );
      const a = i * 1.6;
      f.position.set(
        Math.cos(a) * 0.32,
        (ripe ? 0.75 : 0.8) + Math.sin(a * 1.3) * 0.22,
        Math.sin(a) * 0.32
      );
      f.scale.set(1, 0.9, 1);
      f.castShadow = true;
      g.add(f);
    }
  }

  return g;
}

// ═══════════════════════════════════════════════════════════════
//  WORLD (lights, terrain, sky, vegetation, pond, clouds, atmosphere)
// ═══════════════════════════════════════════════════════════════

export async function createWorld(scene, renderer, camera, opts = {}) {
  const report = opts.progress || (() => {});

  // ── Lights ────────────────────────────────────────────────
  report(24, 'placing sun');
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.7);
  sunLight.position.set(20, 40, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -55;
  sunLight.shadow.camera.right = 55;
  sunLight.shadow.camera.top = 55;
  sunLight.shadow.camera.bottom = -55;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.autoUpdate = false;
  scene.add(sunLight, sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0xa0c8e8, 0x4a6b3a, 1.0);
  scene.add(hemiLight);

  const ambient = new THREE.AmbientLight(0xfff0d0, 0.22);
  scene.add(ambient);

  // ── Sky dome ─────────────────────────────────────────────
  report(30, 'painting sky');
  const skyGeo = new THREE.SphereGeometry(220, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x5a9bd8) },
      bottomColor: { value: new THREE.Color(0xd8e8f0) },
      sunPos: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color(0xffeecc) },
      offset: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vW;
      void main(){ vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
    `,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor;
      uniform vec3 sunPos; uniform vec3 sunColor;
      varying vec3 vW;
      void main(){
        vec3 dir = normalize(vW);
        float h = clamp(dir.y * 0.5 + 0.5, 0., 1.);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.85));
        float sd = distance(dir, normalize(sunPos));
        col += sunColor * smoothstep(0.4, 0., sd) * 0.85;
        // subtle noise
        float n = fract(sin(dot(dir.xy, vec2(12.9898,78.233))) * 43758.5453);
        col += (n - 0.5) * 0.01;
        gl_FragColor = vec4(col, 1.);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ── Sun disc + stars ─────────────────────────────────────
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  scene.add(sunMesh);

  const starCount = 1400;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random());
    const r = 200;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 30;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.8, transparent: true, opacity: 0, depthWrite: false,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── Clouds ───────────────────────────────────────────────
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, flatShading: true,
    transparent: true, opacity: 0.88,
  });
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const puffs = 4 + (Math.random() * 4 | 0);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(cloudGeo, cloudMat);
      p.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 5
      );
      p.scale.setScalar(1.2 + Math.random() * 1.4);
      g.add(p);
    }
    g.position.set(
      (Math.random() - 0.5) * 160,
      42 + Math.random() * 14,
      (Math.random() - 0.5) * 160
    );
    g.scale.setScalar(2 + Math.random() * 2);
    g.userData = { speed: 0.3 + Math.random() * 0.4 };
    scene.add(g);
    clouds.push(g);
  }

  // ── Terrain ──────────────────────────────────────────────
  report(38, 'raising hills');
  const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 120, 120);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i), z = tPos.getZ(i);
    tPos.setY(i, terrainHeight(x, z));
    const n = noise2D(x * 2.1, z * 2.1);
    const g = 0.35 + (n + 1) * 0.14;
    tColors[i * 3] = 0.22 + g * 0.28;
    tColors[i * 3 + 1] = 0.36 + g * 0.58;
    tColors[i * 3 + 2] = 0.14 + g * 0.18;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 })
  );
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ── Trees ────────────────────────────────────────────────
  report(48, 'planting forest');
  const treeGroup = new THREE.Group();
  scene.add(treeGroup);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.95 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.88, flatShading: true }),
  ];

  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 5 + Math.random() * 30;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    if (Math.abs(x) > HALF_WORLD - 7 || Math.abs(z) > HALF_WORLD - 7) continue;

    const scale = 0.8 + Math.random() * 0.8;
    const g = new THREE.Group();
    const h = (3.2 + Math.random() * 2.2) * scale;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * scale, 0.45 * scale, h, 8),
      trunkMat
    );
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    const leafMat = leafMats[Math.floor(Math.random() * 3)];
    const layers = 3 + (Math.random() * 2 | 0);
    for (let j = 0; j < layers; j++) {
      const r = (1.5 - j * 0.26) * scale;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.35, 7), leafMat);
      leaf.position.y = h * 0.75 + j * 0.9 * scale;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      leaf.rotation.y = Math.random() * Math.PI;
      g.add(leaf);
    }
    g.position.set(x, terrainHeight(x, z), z);
    g.userData = {
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.5 + Math.random() * 0.5,
      baseX: x, baseZ: z,
    };
    treeGroup.add(g);
  }

  // ── Grass ────────────────────────────────────────────────
  report(58, 'growing grass');
  const grassCount = 2800;
  const grassGeo = new THREE.ConeGeometry(0.09, 0.85, 3);
  grassGeo.translate(0, 0.42, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x5fa54a, roughness: 1, flatShading: true,
  });
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  const grassData = [];
  const gDummy = new THREE.Object3D();
  for (let i = 0; i < grassCount; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.92;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.92;
    } while (Math.abs(x) < HALF_GRID + 1.5 && Math.abs(z) < HALF_GRID + 1.5);
    const y = terrainHeight(x, z);
    gDummy.position.set(x, y, z);
    gDummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.9;
    gDummy.scale.set(s, s, s);
    gDummy.updateMatrix();
    grassMesh.setMatrixAt(i, gDummy.matrix);
    grassData.push({
      x, z, y,
      baseRot: gDummy.rotation.y,
      phase: Math.random() * Math.PI * 2,
      s,
    });
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  grassMesh.receiveShadow = true;
  scene.add(grassMesh);

  // ── Flowers ──────────────────────────────────────────────
  const flowerCount = 180;
  const flowerGeo = new THREE.IcosahedronGeometry(0.14, 0);
  const flowerMat = new THREE.MeshStandardMaterial({
    roughness: 0.7, emissive: 0x220000, emissiveIntensity: 0.15, vertexColors: true,
  });
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const flowerData = [];
  const fDummy = new THREE.Object3D();
  const palette = [0xff88aa, 0xffdd66, 0xff9966, 0xdd88ff, 0xffffff, 0xff6688];
  const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(flowerCount * 3), 3);
  for (let i = 0; i < flowerCount; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    } while (Math.abs(x) < HALF_GRID + 2 && Math.abs(z) < HALF_GRID + 2);
    const y = terrainHeight(x, z) + 0.45;
    fDummy.position.set(x, y, z);
    fDummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3);
    fDummy.scale.setScalar(0.7 + Math.random() * 0.6);
    fDummy.updateMatrix();
    flowerMesh.setMatrixAt(i, fDummy.matrix);
    const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
    colorAttr.setXYZ(i, c.r, c.g, c.b);
    flowerData.push({ x, z, baseY: y, phase: Math.random() * Math.PI * 2 });
  }
  flowerGeo.setAttribute('color', colorAttr);
  flowerMesh.instanceMatrix.needsUpdate = true;
  scene.add(flowerMesh);

  // ── Bushes + rocks ───────────────────────────────────────
  const bushMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.85, 1),
    leafMats[0], 30
  );
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 2 + Math.random() * 14;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    gDummy.position.set(x, terrainHeight(x, z) + 0.4, z);
    gDummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    gDummy.scale.setScalar(0.8 + Math.random() * 0.5);
    gDummy.updateMatrix();
    bushMesh.setMatrixAt(i, gDummy.matrix);
  }
  bushMesh.instanceMatrix.needsUpdate = true;
  bushMesh.castShadow = true;
  scene.add(bushMesh);

  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92, flatShading: true }),
    24
  );
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (Math.abs(x) < HALF_GRID + 2 && Math.abs(z) < HALF_GRID + 2) continue;
    gDummy.position.set(x, terrainHeight(x, z) + 0.2, z);
    gDummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    gDummy.scale.setScalar(0.6 + Math.random() * 0.6);
    gDummy.updateMatrix();
    rockMesh.setMatrixAt(i, gDummy.matrix);
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  rockMesh.castShadow = true;
  scene.add(rockMesh);

  // ── Pond ─────────────────────────────────────────────────
  report(68, 'filling pond');
  const pondPos = new THREE.Vector3(HALF_GRID + 10, 0, -HALF_GRID - 8);
  const pondGeo = new THREE.CircleGeometry(5, 32);
  pondGeo.rotateX(-Math.PI / 2);
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x4a90b0, roughness: 0.12, metalness: 0.7,
    transparent: true, opacity: 0.88,
  });
  const pondMesh = new THREE.Mesh(pondGeo, pondMat);
  pondMesh.position.set(pondPos.x, terrainHeight(pondPos.x, pondPos.z) + 0.09, pondPos.z);
  scene.add(pondMesh);

  // ── Particles (dust pool, exposed globally) ──────────────
  const particlePool = [];
  const particleGeo = new THREE.SphereGeometry(0.07, 5, 4);
  const MAX_PARTICLES = 180;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = new THREE.Mesh(
      particleGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    );
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
      d.active = true;
      d.life = opts.life || 1.2;
      d.maxLife = d.life;
      d.gravity = opts.gravity ?? -4;
      const sp = opts.spread || 2;
      d.vel.set(
        (Math.random() - 0.5) * sp,
        Math.random() * (opts.up || 2) + 0.3,
        (Math.random() - 0.5) * sp
      );
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

  // Expose dust spawner globally (used by game.js HUD)
  window.__spawnDust = (x, z, color, count = 12, up = 1.8) => {
    const y = terrainHeight(x, z) + 0.5;
    spawnParticles(new THREE.Vector3(x, y, z), {
      color, count, spread: 1.6, up: up * 1.5, life: 1.0, gravity: -6,
    });
  };

  // ── Pollen + fireflies ───────────────────────────────────
  const pollenCount = 240;
  const pollenGeo = new THREE.BufferGeometry();
  const pollenPos = new Float32Array(pollenCount * 3);
  const pollenVel = [];
  for (let i = 0; i < pollenCount; i++) {
    pollenPos[i * 3] = (Math.random() - 0.5) * 70;
    pollenPos[i * 3 + 1] = Math.random() * 14 + 1;
    pollenPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    pollenVel.push({
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.2,
      z: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
    });
  }
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({
    color: 0xffffcc, size: 0.14, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(pollen);

  const fireflyCount = 80;
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPos = new Float32Array(fireflyCount * 3);
  const fireflyData = [];
  for (let i = 0; i < fireflyCount; i++) {
    fireflyPos[i * 3] = (Math.random() - 0.5) * 50;
    fireflyPos[i * 3 + 1] = 0.5 + Math.random() * 3;
    fireflyPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    fireflyData.push({
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.7,
    });
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
  const fireflyMat = new THREE.PointsMaterial({
    color: 0xffff88, size: 0.35, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
  scene.add(fireflies);

  // ── Time of day updater ──────────────────────────────────
  let lastSunAngle = 0;
  function updateTime(dt, timeOfDay) {
    const t = (timeOfDay + dt / 300) % 1;
    const angle = (t - 0.25) * Math.PI * 2;
    const sunX = Math.cos(angle) * 80;
    const sunY = Math.sin(angle) * 60;
    const sunZ = -Math.cos(angle) * 20;
    sunMesh.position.set(sunX, sunY, sunZ);
    sunLight.position.set(sunX * 0.5, Math.max(5, sunY), sunZ * 0.5);
    sunLight.target.position.set(0, 0, 0);
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
    sunLight.color.copy(sunCol);
    sunLight.intensity = sunInt;
    hemiLight.intensity = hemiInt;
    scene.fog.color.copy(fogCol);
    scene.background.copy(fogCol);
    sunMesh.material.color.copy(
      t < 0.25 || t > 0.75 ? new THREE.Color(0xdde8ff) : new THREE.Color(0xffe8a0)
    );
    const dayness = Math.max(0, 1 - Math.abs(t - 0.5) * 3);
    starMat.opacity = Math.max(0, 1 - dayness * 1.3);
    fireflyMat.opacity = Math.max(0, 1 - dayness * 1.2) * 0.85;
  }

  // ── Per-frame world animation ────────────────────────────
  let elapsedLocal = 0;
  function update(dt) {
    elapsedLocal += dt;

    // Trees sway
    for (const tr of treeGroup.children) {
      const d = tr.userData;
      const dx = d.baseX - camera.position.x;
      const dz = d.baseZ - camera.position.z;
      if (dx * dx + dz * dz < 2600) {
        const sway = Math.sin(elapsedLocal * d.swaySpeed + d.sway) * 0.022;
        tr.rotation.z = sway;
        tr.rotation.x = sway * 0.55;
      }
    }

    // Grass sway (update every 2nd frame to save CPU)
    if ((elapsedLocal * 60 | 0) % 2 === 0) {
      for (let i = 0; i < grassData.length; i++) {
        const d = grassData[i];
        const sway = Math.sin(elapsedLocal * 1.8 + d.phase + d.x * 0.3) * 0.16;
        gDummy.position.set(d.x, d.y, d.z);
        gDummy.rotation.set(sway, d.baseRot, sway * 0.7);
        gDummy.scale.set(d.s, d.s, d.s);
        gDummy.updateMatrix();
        grassMesh.setMatrixAt(i, gDummy.matrix);
      }
      grassMesh.instanceMatrix.needsUpdate = true;
    }

    // Flower sway
    for (let i = 0; i < flowerData.length; i++) {
      const d = flowerData[i];
      const bob = Math.sin(elapsedLocal * 2 + d.phase) * 0.04;
      fDummy.position.set(d.x, d.baseY + bob, d.z);
      fDummy.rotation.set(
        Math.sin(elapsedLocal * 1.4 + d.phase) * 0.2,
        d.phase,
        Math.cos(elapsedLocal * 1.2 + d.phase) * 0.15
      );
      fDummy.scale.setScalar(0.7 + Math.sin(d.phase) * 0.1);
      fDummy.updateMatrix();
      flowerMesh.setMatrixAt(i, fDummy.matrix);
    }
    flowerMesh.instanceMatrix.needsUpdate = true;

    // Clouds drift
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 100) c.position.x = -100;
    }

    // Pond shimmer
    pondMat.color.setHSL(0.55, 0.4, 0.42 + Math.sin(elapsedLocal) * 0.03);

    // Pollen drift
    const pp = pollen.geometry.attributes.position;
    for (let i = 0; i < pollenCount; i++) {
      const v = pollenVel[i];
      pp.array[i * 3] += v.x * dt;
      pp.array[i * 3 + 1] += v.y * dt + Math.cos(elapsedLocal * 0.7 + v.phase) * 0.002;
      pp.array[i * 3 + 2] += v.z * dt;
      if (pp.array[i * 3 + 1] > 15) pp.array[i * 3 + 1] = 1;
      if (pp.array[i * 3 + 1] < 0.5) pp.array[i * 3 + 1] = 1;
    }
    pp.needsUpdate = true;

    // Fireflies drift
    const fp = fireflies.geometry.attributes.position;
    for (let i = 0; i < fireflyCount; i++) {
      const d = fireflyData[i];
      fp.array[i * 3] += Math.sin(elapsedLocal * d.speed + d.phase) * 0.01;
      fp.array[i * 3 + 1] += Math.cos(elapsedLocal * d.speed * 1.3 + d.phase) * 0.008;
      fp.array[i * 3 + 2] += Math.cos(elapsedLocal * d.speed * 0.8 + d.phase) * 0.01;
    }
    fp.needsUpdate = true;

    // Particles
    updateParticles(dt);
  }

  return {
    scene, sunLight, hemiLight, sunMesh, starMat,
    skyMat, treeGroup, grassMesh, flowerMesh, pondMat,
    updateTime, update,
  };
}

// ── Internal ─────────────────────────────────────────────────
function noise2D(x, z) {
  return Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.6
       + Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.21 + 3.2) * 0.3
       + Math.sin(x * 0.4 + 5.1) * Math.cos(z * 0.37 + 1.3) * 0.1;
}