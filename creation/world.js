import * as THREE from 'three';

// Shared world state — mutated by game.js
export const WORLD_SIZE = 70;
export const GRID_SIZE = 14;
export const CELL = 4;
export const HALF_WORLD = WORLD_SIZE / 2;
export const HALF_GRID = (GRID_SIZE * CELL) / 2;

// Terrain noise
export function noise2D(x, z) {
  return Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.6
       + Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.21 + 3.2) * 0.3
       + Math.sin(x * 0.4 + 5.1) * Math.cos(z * 0.37 + 1.3) * 0.1;
}
export function terrainHeight(x, z) {
  const inGrid = Math.abs(x) < HALF_GRID + 4 && Math.abs(z) < HALF_GRID + 4;
  const falloff = inGrid ? Math.max(0, 1 - (Math.max(Math.abs(x), Math.abs(z)) - HALF_GRID) / 6) : 0;
  return noise2D(x, z) * 2.2 * (1 - falloff * 0.9);
}

// ── SKY ──
export function buildSky(scene) {
  const geo = new THREE.SphereGeometry(180, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x5a9bd8) },
      bottomColor: { value: new THREE.Color(0xd8e8f0) },
      sunPos: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color(0xffeecc) },
    },
    vertexShader: `varying vec3 vW; void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 bottomColor;
      uniform vec3 sunPos; uniform vec3 sunColor;
      varying vec3 vW;
      void main(){
        vec3 dir = normalize(vW);
        float h = clamp(dir.y*0.5+0.5,0.,1.);
        vec3 col = mix(bottomColor, topColor, pow(h,0.85));
        float sd = distance(dir, normalize(sunPos));
        col += sunColor * smoothstep(0.4,0.,sd) * 0.85;
        float n = fract(sin(dot(dir.xy,vec2(12.9898,78.233)))*43758.5453);
        col += (n-0.5)*0.012;
        gl_FragColor = vec4(col,1.);
      }`
  });
  scene.add(new THREE.Mesh(geo, mat));
  return mat;
}

export function buildStars(scene) {
  const count = 1200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random());
    const r = 170;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) + 30;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0 });
  scene.add(new THREE.Points(geo, mat));
  return mat;
}

export function buildSunDisc(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(5, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  scene.add(mesh);
  return mesh;
}

export function buildClouds(scene) {
  const clouds = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.9 });
  const geo = new THREE.SphereGeometry(1, 6, 5);
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const puffs = 3 + (Math.random() * 3 | 0);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 4);
      p.scale.setScalar(1.2 + Math.random() * 1.3);
      g.add(p);
    }
    g.position.set((Math.random() - 0.5) * 140, 40 + Math.random() * 12, (Math.random() - 0.5) * 140);
    g.scale.setScalar(2 + Math.random() * 1.8);
    g.userData = { speed: 0.3 + Math.random() * 0.4 };
    scene.add(g);
    clouds.push(g);
  }
  return clouds;
}

// ── TERRAIN ──
export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    const n = noise2D(x * 2.1, z * 2.1);
    const g = 0.35 + (n + 1) * 0.12;
    colors[i * 3] = 0.26 + g * 0.28;
    colors[i * 3 + 1] = 0.40 + g * 0.55;
    colors[i * 3 + 2] = 0.16 + g * 0.14;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// ── FARM GRID ──
function makeSoilTexture(moisture = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  const base = moisture > 0.5 ? [40, 26, 14] : [70, 48, 28];
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 1800; i++) {
    const v = Math.random() * 40 - 20;
    ctx.fillStyle = `rgba(${base[0] + v},${base[1] + v * 0.8},${base[2] + v * 0.5},0.9)`;
    ctx.fillRect(Math.random() * 96, Math.random() * 96, 1.5, 1.5);
  }
  ctx.strokeStyle = moisture > 0.5 ? 'rgba(20,12,6,0.7)' : 'rgba(30,20,12,0.6)';
  ctx.lineWidth = 2;
  for (let y = 6; y < 96; y += 12) {
    ctx.beginPath();
    for (let x = 0; x < 96; x += 5) ctx.lineTo(x, y + Math.sin(x * 0.14) * 1.2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildFarmGrid(scene) {
  const farmCells = [];
  const group = new THREE.Group();
  scene.add(group);

  const grassTex = makeSoilTexture(0);
  const tilledTex = makeSoilTexture(0.1);
  const wetTex = makeSoilTexture(0.9);

  const plotGeo = new THREE.BoxGeometry(CELL * 0.94, 0.18, CELL * 0.94);
  const matGrass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  const matTilled = new THREE.MeshStandardMaterial({ map: tilledTex, roughness: 1 });
  const matWet = new THREE.MeshStandardMaterial({ map: wetTex, roughness: 0.78 });

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const px = (gx - GRID_SIZE / 2 + 0.5) * CELL;
      const pz = (gz - GRID_SIZE / 2 + 0.5) * CELL;
      const base = new THREE.Mesh(plotGeo, matGrass);
      base.position.set(px, 0.09, pz);
      base.receiveShadow = true;
      group.add(base);
      farmCells.push({ gx, gz, x: px, z: pz, base, state: 'grass', growTime: 0, waterTime: 0, mesh: null, growthStage: -1 });
    }
  }

  // Fence — instanced
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.92 });
  const posts = [], rails = [];
  const postGeo = new THREE.BoxGeometry(0.22, 1.5, 0.22);
  const railGeo = new THREE.BoxGeometry(CELL, 0.1, 0.1);
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = (i - GRID_SIZE / 2) * CELL;
    const edges = [[p, -HALF_GRID, 0], [p, HALF_GRID, 0], [-HALF_GRID, p, Math.PI / 2], [HALF_GRID, p, Math.PI / 2]];
    for (const [x, z, rot] of edges) {
      posts.push({ x, y: 0.75, z, rot: 0 });
      if (i < GRID_SIZE) {
        const np = p + CELL / 2;
        if (rot === 0) rails.push({ x: np, y: 0.9, z, rot: 0 });
        else rails.push({ x, y: 0.9, z: np, rot: Math.PI / 2 });
      }
    }
  }
  const dummy = new THREE.Object3D();
  const postMesh = new THREE.InstancedMesh(postGeo, woodMat, posts.length);
  posts.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.rot, 0);
    dummy.updateMatrix(); postMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.castShadow = true;
  group.add(postMesh);

  const railMesh = new THREE.InstancedMesh(railGeo, woodMat, rails.length);
  rails.forEach((r, i) => {
    dummy.position.set(r.x, r.y, r.z); dummy.rotation.set(0, r.rot, 0);
    dummy.updateMatrix(); railMesh.setMatrixAt(i, dummy.matrix);
  });
  railMesh.instanceMatrix.needsUpdate = true;
  railMesh.castShadow = true;
  group.add(railMesh);

  return { farmCells, group, materials: { matGrass, matTilled, matWet } };
}

// ── VEGETATION ──
export function buildVegetation(scene) {
  const treeGroup = new THREE.Group();
  scene.add(treeGroup);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.96 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x4a8b3a, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3d7a2e, roughness: 0.9, flatShading: true }),
  ];

  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 4 + Math.random() * 24;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    if (Math.abs(x) > HALF_WORLD - 6 || Math.abs(z) > HALF_WORLD - 6) continue;
    const scale = 0.7 + Math.random() * 0.7;
    const g = new THREE.Group();
    const h = (3 + Math.random() * 2) * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, h, 6), trunkMat);
    trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    const layers = 3 + (Math.random() * 2 | 0);
    const leafMat = leafMats[Math.floor(Math.random() * 3)];
    for (let j = 0; j < layers; j++) {
      const r = (1.4 - j * 0.24) * scale;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.3, 6), leafMat);
      leaf.position.y = h * 0.75 + j * 0.85 * scale;
      leaf.castShadow = true;
      leaf.rotation.y = Math.random() * Math.PI;
      g.add(leaf);
    }
    g.position.set(x, terrainHeight(x, z), z);
    g.userData = { sway: Math.random() * Math.PI * 2, swaySpeed: 0.5 + Math.random() * 0.5, baseX: x, baseZ: z };
    treeGroup.add(g);
  }

  // Grass
  const grassCount = 2200;
  const grassGeo = new THREE.ConeGeometry(0.09, 0.8, 3);
  grassGeo.translate(0, 0.4, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5fa54a, roughness: 1, flatShading: true });
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  const grassData = [];
  const gDummy = new THREE.Object3D();
  for (let i = 0; i < grassCount; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
      z = (Math.random() - 0.5) * WORLD_SIZE * 0.9;
    } while (Math.abs(x) < HALF_GRID + 1 && Math.abs(z) < HALF_GRID + 1);
    const y = terrainHeight(x, z);
    gDummy.position.set(x, y, z);
    gDummy.rotation.y = Math.random() * Math.PI;
    const s = 0.7 + Math.random() * 0.9;
    gDummy.scale.set(s, s, s);
    gDummy.updateMatrix();
    grassMesh.setMatrixAt(i, gDummy.matrix);
    grassData.push({ x, z, y, baseRot: gDummy.rotation.y, phase: Math.random() * Math.PI * 2, s });
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  scene.add(grassMesh);

  // Flowers
  const flowerCount = 140;
  const flowerGeo = new THREE.IcosahedronGeometry(0.15, 0);
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: 0x220000, emissiveIntensity: 0.15, vertexColors: true });
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

  // Bushes
  const bushMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 1), leafMats[0], 26);
  const d = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = HALF_GRID + 2 + Math.random() * 12;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    d.position.set(x, terrainHeight(x, z) + 0.4, z);
    d.rotation.set(0, Math.random() * Math.PI * 2, 0);
    d.scale.setScalar(0.8 + Math.random() * 0.5);
    d.updateMatrix();
    bushMesh.setMatrixAt(i, d.matrix);
  }
  bushMesh.instanceMatrix.needsUpdate = true;
  bushMesh.castShadow = true;
  scene.add(bushMesh);

  // Rocks
  const rockMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92, flatShading: true }),
    20
  );
  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (Math.abs(x) < HALF_GRID + 2 && Math.abs(z) < HALF_GRID + 2) continue;
    d.position.set(x, terrainHeight(x, z) + 0.2, z);
    d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    d.scale.setScalar(0.6 + Math.random() * 0.6);
    d.updateMatrix();
    rockMesh.setMatrixAt(i, d.matrix);
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  rockMesh.castShadow = true;
  scene.add(rockMesh);

  return { treeGroup, grassMesh, grassData, flowerMesh, flowerData, gDummy, fDummy };
}

// ── POND ──
export function buildPond(scene) {
  const pos = new THREE.Vector3(HALF_GRID + 9, 0, -HALF_GRID - 7);
  const geo = new THREE.CircleGeometry(4.5, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a90b0, roughness: 0.15, metalness: 0.65, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, terrainHeight(pos.x, pos.z) + 0.08, pos.z);
  scene.add(mesh);
  return { mesh, mat };
}

// ── PARTICLES / ATMOSPHERE ──
export function buildPollen(scene) {
  const count = 200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 12 + 1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    vel.push({ x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.2, z: (Math.random() - 0.5) * 0.3, phase: Math.random() * Math.PI * 2 });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffcc, size: 0.14, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(points);
  return { points, vel, count };
}

export function buildFireflies(scene) {
  const count = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 45;
    pos[i * 3 + 1] = 0.5 + Math.random() * 3;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 45;
    data.push({ phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.7 });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffff88, size: 0.32, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, mat, data, count };
}

export function buildBirds(scene) {
  const birds = [];
  const bodyGeo = new THREE.SphereGeometry(0.15, 5, 4);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a });
  const wingGeo = new THREE.PlaneGeometry(0.5, 0.2);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(bodyGeo, bodyMat); b.scale.set(1, 0.7, 1.4); g.add(b);
    const wings = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, wingMat);
      w.position.x = side * 0.28; w.rotation.z = side * 0.2;
      g.add(w); wings.push(w);
    }
    g.userData = {
      wings, phase: Math.random() * Math.PI * 2,
      radius: 20 + Math.random() * 15, height: 20 + Math.random() * 10,
      angle: Math.random() * Math.PI * 2,
    };
    scene.add(g);
    birds.push(g);
  }
  return birds;
}

// ── CROPS ──
const sproutMat = new THREE.MeshStandardMaterial({ color: 0x6aab4a, roughness: 0.8 });
const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a9b3a, roughness: 0.85 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x6abb4a, roughness: 0.85 });
const fruitMat = new THREE.MeshStandardMaterial({ color: 0xe83a3a, roughness: 0.45, emissive: 0x330000, emissiveIntensity: 0.28 });
const greenFruitMat = new THREE.MeshStandardMaterial({ color: 0x7abc4a, roughness: 0.5 });

export function cropStageOf(g) {
  if (g < 0.25) return 0;
  if (g < 0.6) return 1;
  if (g < 0.9) return 2;
  return 3;
}

export function createCropMesh(growth) {
  const g = new THREE.Group();
  if (growth < 0.25) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 4), sproutMat);
    sp.position.y = 0.1; sp.scale.set(1, 0.55, 1); sp.castShadow = true; g.add(sp);
  } else if (growth < 0.6) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.85, 5), stemMat);
    stem.position.y = 0.42; stem.castShadow = true; g.add(stem);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 4, 3), leafMat);
      l.scale.set(1.4, 0.4, 1);
      const a = i * 2.1;
      l.position.set(Math.cos(a) * 0.24, 0.42 + i * 0.14, Math.sin(a) * 0.24);
      l.rotation.y = a; l.castShadow = true; g.add(l);
    }
  } else {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 1.15, 5), stemMat);
    stem.position.y = 0.57; stem.castShadow = true; g.add(stem);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 4, 3), leafMat);
      l.scale.set(1.5, 0.35, 1);
      const a = i * 1.3;
      l.position.set(Math.cos(a) * 0.35, 0.3 + i * 0.16, Math.sin(a) * 0.35);
      l.rotation.y = a; l.castShadow = true; g.add(l);
    }
    const ripe = growth >= 0.9;
    for (let i = 0; i < (ripe ? 4 : 3); i++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(ripe ? 0.17 : 0.1, ripe ? 8 : 6, 6),
        ripe ? fruitMat : greenFruitMat
      );
      const a = i * 1.6;
      f.position.set(Math.cos(a) * 0.3, (ripe ? 0.7 : 0.75) + Math.sin(a * 1.3) * 0.22, Math.sin(a) * 0.3);
      f.castShadow = true; g.add(f);
    }
  }
  return g;
}

export function updateCropMesh(cell, plotsGroup) {
  if (cell.mesh) {
    plotsGroup.remove(cell.mesh);
    cell.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    cell.mesh = null;
  }
  if (cell.state === 'planted' || cell.state === 'harvestable') {
    cell.mesh = createCropMesh(cell.growTime);
    cell.mesh.position.set(cell.x, 0.18, cell.z);
    plotsGroup.add(cell.mesh);
  }
}