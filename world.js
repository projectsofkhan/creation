import * as THREE from 'three';
import { gameState, terrainHeight as defaultHeight, setTerrainHeightFn, Audio, HUD } from './engine.js';

/* ═══════════════════════════════════════════════════════════════
   VERDANT VALE — world.js
   Infinite terrain · house · stable · seed shed · sky · weather
   ═══════════════════════════════════════════════════════════════ */

// ── Constants ───────────────────────────────────────────────
const CHUNK_SIZE = 40;
const CHUNK_SEGMENTS = 32;
const CHUNK_VIEW = 3;               // 3 chunks in each direction (7x7 = 49 chunks loaded)
const HOUSE_POS = { x: 0, z: -18 };
const STABLE_POS = { x: 18, z: -14 };
const SHED_POS = { x: -18, z: -14 };

// ═══════════════════════════════════════════════════════════════
//  NOISE — deterministic, seeded, smoother than last version
// ═══════════════════════════════════════════════════════════════
let _seed = 20250101;
function rand() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = smoothstep(xf), v = smoothstep(zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm2(x, z, octaves = 4) {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2(x * freq, z * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return total / max;
}

// ── Terrain height function (public, used by engine + player) ──
export function infiniteTerrainHeight(x, z) {
  // River carve: a winding river that flows east-west far from spawn
  const riverCenter = Math.sin(x * 0.008) * 30 - 100; // river at z ≈ -100, meandering
  const distFromRiver = Math.abs(z - riverCenter);
  const riverDepth = distFromRiver < 6 ? -(6 - distFromRiver) * 0.6 : 0;

  // Hills — multiple octaves
  const hills = fbm2(x * 0.012 + 100, z * 0.012 + 100, 4) * 8;
  // Mountains — rare, far away
  const mountainMask = Math.max(0, fbm2(x * 0.004 + 200, z * 0.004 + 200, 3) - 0.62) * 6;
  const mountains = mountainMask * 30;
  // Fine bumps
  const bumps = fbm2(x * 0.09, z * 0.09, 2) * 0.6;

  // Flat farm area near spawn
  const distFromSpawn = Math.sqrt(x * x + z * z);
  const flatMask = Math.max(0, 1 - distFromSpawn / 55);
  const flatWeight = smoothstep(flatMask);

  const rawHeight = hills + mountains + bumps + riverDepth;
  return rawHeight * (1 - flatWeight * 0.92) + flatWeight * 0.15;
}

// Register with engine
setTerrainHeightFn(infiniteTerrainHeight);

// ═══════════════════════════════════════════════════════════════
//  MATERIALS — realistic, calming palette
// ═══════════════════════════════════════════════════════════════
const MAT = {
  // Ground / dirt
  grass: new THREE.MeshStandardMaterial({
    color: 0x5a8a4a, roughness: 0.94, metalness: 0.0,
  }),
  dirt: new THREE.MeshStandardMaterial({
    color: 0x6a4a30, roughness: 0.97,
  }),
  // Wood
  woodLight: new THREE.MeshStandardMaterial({ color: 0xa88860, roughness: 0.88 }),
  woodMed: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.92 }),
  // Roofs
  roofRed: new THREE.MeshStandardMaterial({ color: 0xa8483a, roughness: 0.8 }),
  roofThatch: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.95 }),
  roofBrown: new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.88 }),
  // Stone
  stone: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92, flatShading: true }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.94, flatShading: true }),
  // Glass
  glass: new THREE.MeshStandardMaterial({
    color: 0x88b0d0, roughness: 0.1, metalness: 0.3,
    transparent: true, opacity: 0.72,
  }),
  windowFrame: new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 }),
  // Metal
  iron: new THREE.MeshStandardMaterial({ color: 0x6a6a70, roughness: 0.5, metalness: 0.8 }),
  ironRust: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85, metalness: 0.3 }),
  // Fabric
  fabric: new THREE.MeshStandardMaterial({ color: 0xb8a880, roughness: 0.95 }),
  burlap: new THREE.MeshStandardMaterial({ color: 0xa89060, roughness: 0.96 }),
  // Vegetation
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.9, flatShading: true }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x356a28, roughness: 0.92, flatShading: true }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6aba4a, roughness: 0.88, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.96 }),
  bush: new THREE.MeshStandardMaterial({ color: 0x4a7a38, roughness: 0.92, flatShading: true }),
  flowerPink: new THREE.MeshStandardMaterial({ color: 0xffa8c8, roughness: 0.7, emissive: 0x331122, emissiveIntensity: 0.15 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.7, emissive: 0x332a00, emissiveIntensity: 0.15 }),
  flowerWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x222222, emissiveIntensity: 0.1 }),
  flowerPurple: new THREE.MeshStandardMaterial({ color: 0xc88aff, roughness: 0.7, emissive: 0x220033, emissiveIntensity: 0.15 }),
  // Water
  water: new THREE.MeshStandardMaterial({
    color: 0x4a90b0, roughness: 0.08, metalness: 0.65,
    transparent: true, opacity: 0.85,
  }),
  // Hay
  hay: new THREE.MeshStandardMaterial({ color: 0xc8a850, roughness: 0.95 }),
  // Interactable highlight
  highlight: new THREE.MeshStandardMaterial({
    color: 0xe0ffa0, emissive: 0x80a040, emissiveIntensity: 0.4,
    transparent: true, opacity: 0.5,
  }),
};

// ═══════════════════════════════════════════════════════════════
//  CHUNK MANAGER — infinite terrain
// ═══════════════════════════════════════════════════════════════
class ChunkManager {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.treeChunks = new Map();
    this.bushChunks = new Map();
    this.flowerChunks = new Map();
    this.centerChunk = { x: 999, z: 999 };
  }

  key(cx, cz) { return `${cx},${cz}`; }

  update(playerX, playerZ) {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cz = Math.floor(playerZ / CHUNK_SIZE);

    // Only rebuild when we cross a chunk boundary
    if (cx === this.centerChunk.x && cz === this.centerChunk.z) return;
    this.centerChunk = { x: cx, z: cz };

    const toAdd = [];
    const keep = new Set();

    for (let dx = -CHUNK_VIEW; dx <= CHUNK_VIEW; dx++) {
      for (let dz = -CHUNK_VIEW; dz <= CHUNK_VIEW; dz++) {
        const ccx = cx + dx;
        const ccz = cz + dz;
        const k = this.key(ccx, ccz);
        keep.add(k);
        if (!this.chunks.has(k)) toAdd.push({ cx: ccx, cz: ccz, k });
      }
    }

    // Remove chunks no longer needed
    for (const [k, chunk] of this.chunks) {
      if (!keep.has(k)) this.unloadChunk(k);
    }

    // Generate new chunks (a couple per frame to spread cost)
    for (const { cx: ccx, cz: ccz, k } of toAdd) {
      this.loadChunk(ccx, ccz, k);
    }
  }

  unloadChunk(k) {
    const terrain = this.chunks.get(k);
    if (terrain) {
      this.scene.remove(terrain);
      terrain.geometry.dispose();
    }
    this.chunks.delete(k);

    const trees = this.treeChunks.get(k);
    if (trees) {
      this.scene.remove(trees);
      trees.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.treeChunks.delete(k);

    const bushes = this.bushChunks.get(k);
    if (bushes) {
      this.scene.remove(bushes);
      bushes.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.bushChunks.delete(k);

    const flowers = this.flowerChunks.get(k);
    if (flowers) {
      this.scene.remove(flowers);
      flowers.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    this.flowerChunks.delete(k);
  }

  loadChunk(cx, cz, key) {
    const terrain = this.buildTerrainMesh(cx, cz);
    this.scene.add(terrain);
    this.chunks.set(key, terrain);

    const trees = this.buildTreesForChunk(cx, cz);
    if (trees.children.length > 0) {
      this.scene.add(trees);
      this.treeChunks.set(key, trees);
    }

    const bushes = this.buildBushesForChunk(cx, cz);
    if (bushes.children.length > 0) {
      this.scene.add(bushes);
      this.bushChunks.set(key, bushes);
    }

    const flowers = this.buildFlowersForChunk(cx, cz);
    if (flowers.children.length > 0) {
      this.scene.add(flowers);
      this.flowerChunks.set(key, flowers);
    }
  }

  buildTerrainMesh(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const h = infiniteTerrainHeight(wx, wz);
      pos.setY(i, h);

      // Color by height: low = dark green, mid = grass, high = rocky/dry
      const n = fbm2(wx * 0.06, wz * 0.06, 2);
      let r, g, b;
      if (h < -0.2) {
        // Near river — muddy
        r = 0.30 + n * 0.15;
        g = 0.40 + n * 0.12;
        b = 0.25 + n * 0.10;
      } else if (h < 3) {
        // Grass
        r = 0.28 + n * 0.22;
        g = 0.50 + n * 0.20;
        b = 0.22 + n * 0.12;
      } else if (h < 8) {
        // Transition
        r = 0.35 + n * 0.20;
        g = 0.50 + n * 0.15;
        b = 0.28 + n * 0.12;
      } else {
        // Rocky mountain top
        r = 0.50 + n * 0.20;
        g = 0.52 + n * 0.15;
        b = 0.48 + n * 0.12;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(baseX, 0, baseZ);
    mesh.receiveShadow = true;
    return mesh;
  }

  buildTreesForChunk(cx, cz) {
    const group = new THREE.Group();
    const seedRng = (cx * 73856093) ^ (cz * 19349663);
    let r = Math.abs(seedRng) % 100000;
    const nextRand = () => {
      r = (r * 16807) % 2147483647;
      return (r - 1) / 2147483646;
    };

    // Skip trees near the house / stable / shed area
    const houseX = HOUSE_POS.x, houseZ = HOUSE_POS.z;
    const stableX = STABLE_POS.x, stableZ = STABLE_POS.z;
    const shedX = SHED_POS.x, shedZ = SHED_POS.z;

    const treeCount = 6 + Math.floor(nextRand() * 6);
    for (let i = 0; i < treeCount; i++) {
      const lx = nextRand() * CHUNK_SIZE;
      const lz = nextRand() * CHUNK_SIZE;
      const wx = cx * CHUNK_SIZE + lx - CHUNK_SIZE / 2;
      const wz = cz * CHUNK_SIZE + lz - CHUNK_SIZE / 2;

      // Distance checks — skip if close to buildings
      const dHouse = Math.hypot(wx - houseX, wz - houseZ);
      const dStable = Math.hypot(wx - stableX, wz - stableZ);
      const dShed = Math.hypot(wx - shedX, wz - shedZ);
      if (dHouse < 18 || dStable < 10 || dShed < 10) continue;

      // Skip if on a mountain
      const h = infiniteTerrainHeight(wx, wz);
      if (h > 6 || h < -0.5) continue;

      const scale = 0.8 + nextRand() * 1.2;
      const tree = this.buildTree(scale, nextRand);
      tree.position.set(wx, h, wz);
      tree.rotation.y = nextRand() * Math.PI * 2;
      group.add(tree);
    }

    return group;
  }

  buildTree(scale, randFn) {
    const g = new THREE.Group();
    const h = (3.5 + randFn() * 2.5) * scale;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * scale, 0.42 * scale, h, 7),
      MAT.bark
    );
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    const leafMat = [MAT.leaf, MAT.leafDark, MAT.leafLight][Math.floor(randFn() * 3)];
    const layers = 3 + Math.floor(randFn() * 2);
    for (let j = 0; j < layers; j++) {
      const r = (1.5 - j * 0.28) * scale;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.35, 7), leafMat);
      leaf.position.y = h * 0.7 + j * 0.85 * scale;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      leaf.rotation.y = randFn() * Math.PI * 2;
      g.add(leaf);
    }

    return g;
  }

  buildBushesForChunk(cx, cz) {
    const group = new THREE.Group();
    let r = Math.abs((cx * 19349663) ^ (cz * 83492791)) % 100000;
    const nextRand = () => {
      r = (r * 16807) % 2147483647;
      return (r - 1) / 2147483646;
    };

    const count = 2 + Math.floor(nextRand() * 4);
    for (let i = 0; i < count; i++) {
      const lx = nextRand() * CHUNK_SIZE;
      const lz = nextRand() * CHUNK_SIZE;
      const wx = cx * CHUNK_SIZE + lx - CHUNK_SIZE / 2;
      const wz = cz * CHUNK_SIZE + lz - CHUNK_SIZE / 2;

      const h = infiniteTerrainHeight(wx, wz);
      if (h > 5 || h < 0) continue;

      const bush = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7 + nextRand() * 0.5, 1),
        MAT.bush
      );
      bush.position.set(wx, h + 0.4, wz);
      bush.rotation.set(nextRand() * 0.3, nextRand() * Math.PI * 2, nextRand() * 0.3);
      bush.castShadow = true;
      group.add(bush);
    }
    return group;
  }

  buildFlowersForChunk(cx, cz) {
    const group = new THREE.Group();
    let r = Math.abs((cx * 49287673) ^ (cz * 83492791)) % 100000;
    const nextRand = () => {
      r = (r * 16807) % 2147483647;
      return (r - 1) / 2147483646;
    };

    const count = 4 + Math.floor(nextRand() * 8);
    const flowerMats = [MAT.flowerPink, MAT.flowerYellow, MAT.flowerWhite, MAT.flowerPurple];
    for (let i = 0; i < count; i++) {
      const lx = nextRand() * CHUNK_SIZE;
      const lz = nextRand() * CHUNK_SIZE;
      const wx = cx * CHUNK_SIZE + lx - CHUNK_SIZE / 2;
      const wz = cz * CHUNK_SIZE + lz - CHUNK_SIZE / 2;

      const h = infiniteTerrainHeight(wx, wz);
      if (h > 4 || h < 0.05) continue;

      const flower = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12, 0),
        flowerMats[Math.floor(nextRand() * flowerMats.length)]
      );
      flower.position.set(wx, h + 0.35, wz);
      flower.rotation.set(nextRand() * 0.5, nextRand() * Math.PI * 2, nextRand() * 0.5);
      group.add(flower);

      // tiny stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4),
        MAT.leaf
      );
      stem.position.set(wx, h + 0.17, wz);
      group.add(stem);
    }
    return group;
  }
}

// ═══════════════════════════════════════════════════════════════
//  WOODEN HOUSE — walkable interior
// ═══════════════════════════════════════════════════════════════
function buildHouse() {
  const group = new THREE.Group();
  const W = 9, D = 11, H = 3.8;
  const wallThickness = 0.25;

  // Foundation — stone base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6),
    MAT.stone
  );
  base.position.y = 0.25;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.12, D),
    MAT.woodMed
  );
  floor.position.y = 0.5 + 0.06;
  floor.receiveShadow = true;
  group.add(floor);

  // Walls — front, back, left, right
  // Back wall (solid)
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, wallThickness),
    MAT.woodLight
  );
  backWall.position.set(0, 0.5 + H / 2, -D / 2 + wallThickness / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, H, D),
    MAT.woodLight
  );
  leftWall.position.set(-W / 2 + wallThickness / 2, 0.5 + H / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Right wall — with a window hole (built as 4 pieces around a hole)
  const winW = 2.2, winH = 1.6;
  const winY = 0.5 + H / 2 + 0.3;
  const rightWallX = W / 2 - wallThickness / 2;

  // Right wall pieces
  const rWallFront = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, H, (D - winW) / 2),
    MAT.woodLight
  );
  rWallFront.position.set(rightWallX, 0.5 + H / 2, (D + winW) / 4);
  rWallFront.castShadow = true;
  rWallFront.receiveShadow = true;
  group.add(rWallFront);

  const rWallBack = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, H, (D - winW) / 2),
    MAT.woodLight
  );
  rWallBack.position.set(rightWallX, 0.5 + H / 2, -(D + winW) / 4);
  rWallBack.castShadow = true;
  rWallBack.receiveShadow = true;
  group.add(rWallBack);

  const rWallTop = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, (H - winH) / 2, winW),
    MAT.woodLight
  );
  rWallTop.position.set(rightWallX, 0.5 + H - (H - winH) / 4, 0);
  rWallTop.castShadow = true;
  rWallTop.receiveShadow = true;
  group.add(rWallTop);

  const rWallBot = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, (H - winH) / 2, winW),
    MAT.woodLight
  );
  rWallBot.position.set(rightWallX, 0.5 + (H - winH) / 4, 0);
  rWallBot.castShadow = true;
  rWallBot.receiveShadow = true;
  group.add(rWallBot);

  // Window glass
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, winH, winW),
    MAT.glass
  );
  glass.position.set(rightWallX, winY, 0);
  group.add(glass);

  // Window cross frame
  const crossH = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.1, winW),
    MAT.windowFrame
  );
  crossH.position.set(rightWallX, winY, 0);
  group.add(crossH);
  const crossV = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, winH, 0.1),
    MAT.windowFrame
  );
  crossV.position.set(rightWallX, winY, 0);
  group.add(crossV);

  // Front wall — with door and a window
  const doorW = 1.6, doorH = 2.4;
  const frontWallX = -W / 2 + (W - doorW - 2.5) / 2; // left piece width
  const frontLeftW = (W - doorW) / 2 - 1.25;

  const fWallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(frontLeftW, H, wallThickness),
    MAT.woodLight
  );
  fWallLeft.position.set(-W / 2 + frontLeftW / 2, 0.5 + H / 2, D / 2 - wallThickness / 2);
  fWallLeft.castShadow = true;
  fWallLeft.receiveShadow = true;
  group.add(fWallLeft);

  const fWallRight = new THREE.Mesh(
    new THREE.BoxGeometry((W - doorW) / 2 - 1.25, H, wallThickness),
    MAT.woodLight
  );
  fWallRight.position.set(W / 2 - ((W - doorW) / 2 - 1.25) / 2, 0.5 + H / 2, D / 2 - wallThickness / 2);
  fWallRight.castShadow = true;
  fWallRight.receiveShadow = true;
  group.add(fWallRight);

  // Front wall top above door
  const fWallTop = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, H - doorH, wallThickness),
    MAT.woodLight
  );
  fWallTop.position.set(0, 0.5 + doorH + (H - doorH) / 2, D / 2 - wallThickness / 2);
  fWallTop.castShadow = true;
  fWallTop.receiveShadow = true;
  group.add(fWallTop);

  // Door (open — invisible)
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.15, 0.1, 0.35),
    MAT.woodDark
  );
  doorFrame.position.set(0, 0.5 + doorH + 0.05, D / 2 - 0.1);
  group.add(doorFrame);

  // Windows on the front wall — decorative on each side
  // (skip for simplicity — front-left/right walls are solid in this version)

  // Roof — 4-sided pyramid over the house
  const roofGeo = new THREE.ConeGeometry(W * 0.78, 2.8, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MAT.roofRed);
  roof.position.y = 0.5 + H + 1.4;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Roof trim
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.4, 0.12, D + 0.4),
    MAT.woodDark
  );
  trim.position.y = 0.5 + H + 0.02;
  group.add(trim);

  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 2.2, 0.9),
    MAT.stoneDark
  );
  chimney.position.set(W * 0.32, 0.5 + H + 1.5, -D * 0.22);
  chimney.castShadow = true;
  group.add(chimney);

  // Chimney top
  const chimneyTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.15, 1.0),
    MAT.stone
  );
  chimneyTop.position.set(W * 0.32, 0.5 + H + 2.6, -D * 0.22);
  group.add(chimneyTop);

  // Warm interior light
  const interiorLight = new THREE.PointLight(0xffd8a0, 1.2, 12, 2);
  interiorLight.position.set(0, 2.2, 0);
  group.add(interiorLight);

  // Interior: bed (soft cloth block)
  const bedFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.35, 2.2),
    MAT.woodDark
  );
  bedFrame.position.set(-W / 2 + 1.5, 0.75, -D / 2 + 1.8);
  bedFrame.castShadow = true;
  group.add(bedFrame);

  const bedMattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.35, 2.05),
    MAT.fabric
  );
  bedMattress.position.set(-W / 2 + 1.5, 1.1, -D / 2 + 1.8);
  group.add(bedMattress);

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.2, 0.5),
    MAT.fabric
  );
  pillow.position.set(-W / 2 + 1.5, 1.35, -D / 2 + 1.0);
  group.add(pillow);

  // Interior: table
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 0.9),
    MAT.woodMed
  );
  tableTop.position.set(W / 2 - 1.8, 1.1, D / 2 - 2.2);
  tableTop.castShadow = true;
  group.add(tableTop);

  for (const [dx, dz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.9, 0.1),
      MAT.woodDark
    );
    leg.position.set(W / 2 - 1.8 + dx, 0.65, D / 2 - 2.2 + dz);
    leg.castShadow = true;
    group.add(leg);
  }

  // Interior: chair
  const chairSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.55),
    MAT.woodMed
  );
  chairSeat.position.set(W / 2 - 1.8, 0.95, D / 2 - 3.2);
  group.add(chairSeat);

  const chairBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.6, 0.08),
    MAT.woodMed
  );
  chairBack.position.set(W / 2 - 1.8, 1.25, D / 2 - 3.45);
  group.add(chairBack);

  // Interior: shelf on back wall
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.08, 0.4),
    MAT.woodDark
  );
  shelf.position.set(0, 2.0, -D / 2 + 0.5);
  group.add(shelf);

  // Interior: a couple books / jars on shelf (decoration)
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.28, 6),
      i % 2 === 0 ? MAT.glass : MAT.burial || MAT.burlap
    );
    jar.position.set(-1.2 + i * 0.6, 2.18, -D / 2 + 0.5);
    group.add(jar);
  }

  // Interactable: door frame acts as "rest" trigger
  doorFrame.userData.interact = {
    type: 'rest',
    prompt: '<span class="key">E</span> Rest — restore energy',
  };

  // Interactable: bed
  bedFrame.userData.interact = {
    type: 'sleep',
    prompt: '<span class="key">E</span> Sleep — skip to morning',
  };

  return group;
}

// ═══════════════════════════════════════════════════════════════
//  HORSE STABLE — lean-to with hay, water trough, feed
// ═══════════════════════════════════════════════════════════════
function buildStable() {
  const group = new THREE.Group();
  const W = 6, D = 5, H = 3.2;

  // Stone base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.3, 0.2, D + 0.3),
    MAT.stone
  );
  base.position.y = 0.1;
  base.receiveShadow = true;
  group.add(base);

  // Floor (straw)
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.06, D),
    MAT.hay
  );
  floor.position.y = 0.23;
  floor.receiveShadow = true;
  group.add(floor);

  // Back wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, 0.2),
    MAT.woodMed
  );
  backWall.position.set(0, H / 2 + 0.2, -D / 2 + 0.1);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, H, D),
    MAT.woodMed
  );
  leftWall.position.set(-W / 2 + 0.1, H / 2 + 0.2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, H, D),
    MAT.woodMed
  );
  rightWall.position.set(W / 2 - 0.1, H / 2 + 0.2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  // Roof — slanted plane over the front
  const roofGeo = new THREE.BoxGeometry(W + 0.8, 0.15, D + 1.2);
  const roof = new THREE.Mesh(roofGeo, MAT.roofBrown);
  roof.position.set(0, H + 0.3, 0.1);
  roof.rotation.x = -0.15;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Support posts
  for (const [x, z] of [[-W / 2 + 0.3, D / 2 - 0.3], [W / 2 - 0.3, D / 2 - 0.3]]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, H, 0.25),
      MAT.woodDark
    );
    post.position.set(x, H / 2 + 0.2, z);
    post.castShadow = true;
    group.add(post);
  }

  // Hay bale (feeding)
  const hay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12),
    MAT.hay
  );
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-W / 2 + 1.2, 0.85, -D / 2 + 1.0);
  hay.castShadow = true;
  hay.receiveShadow = true;
  group.add(hay);

  hay.userData.interact = {
    type: 'feed_horse',
    prompt: '<span class="key">E</span> Grab hay',
  };

  // Water trough
  const trough = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 0.7),
    MAT.woodDark
  );
  trough.position.set(W / 2 - 1.3, 0.5, -D / 2 + 1.0);
  trough.castShadow = true;
  group.add(trough);

  const troughWater = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.25, 0.55),
    MAT.water
  );
  troughWater.position.set(W / 2 - 1.3, 0.62, -D / 2 + 1.0);
  group.add(troughWater);

  trough.userData.interact = {
    type: 'refill_water',
    prompt: '<span class="key">E</span> Fill watering can',
  };

  // Hitching post in front of stable
  const post1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.5, 0.18),
    MAT.woodDark
  );
  post1.position.set(-1.5, 0.75, D / 2 + 1.5);
  post1.castShadow = true;
  group.add(post1);

  const post2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.5, 0.18),
    MAT.woodDark
  );
  post2.position.set(1.5, 0.75, D / 2 + 1.5);
  post2.castShadow = true;
  group.add(post2);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.1, 0.1),
    MAT.woodDark
  );
  rail.position.set(0, 1.35, D / 2 + 1.5);
  group.add(rail);

  return group;
}

// ═══════════════════════════════════════════════════════════════
//  SEED SHED — small wooden building with seed boxes / jars
// ═══════════════════════════════════════════════════════════════
function buildSeedShed() {
  const group = new THREE.Group();
  const W = 4.5, D = 3.5, H = 2.6;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.3, 0.2, D + 0.3),
    MAT.stone
  );
  base.position.y = 0.1;
  base.receiveShadow = true;
  group.add(base);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.08, D),
    MAT.woodMed
  );
  floor.position.y = 0.24;
  floor.receiveShadow = true;
  group.add(floor);

  // Back wall
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, 0.2),
    MAT.woodLight
  );
  back.position.set(0, H / 2 + 0.2, -D / 2 + 0.1);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  // Side walls
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, H, D),
      MAT.woodLight
    );
    w.position.set(side * (W / 2 - 0.1), H / 2 + 0.2, 0);
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
  }

  // Roof (peaked)
  const roofGeo = new THREE.ConeGeometry(3.4, 1.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MAT.roofThatch);
  roof.position.y = H + 1.0;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Interior light
  const shedLight = new THREE.PointLight(0xffe0a0, 0.7, 6, 2);
  shedLight.position.set(0, 1.8, 0);
  group.add(shedLight);

  // Shelving unit — 3 shelves with seed jars/boxes
  const shelfUnit = new THREE.Group();
  for (let row = 0; row < 3; row++) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.08, 0.5),
      MAT.woodDark
    );
    shelf.position.set(0, 0.6 + row * 0.55, -D / 2 + 0.4);
    shelf.receiveShadow = true;
    shelf.castShadow = true;
    shelfUnit.add(shelf);
  }
  group.add(shelfUnit);

  // Seed containers — 6 different seeds, each is a small labeled jar
  const seedTypes = [
    { id: 'tomato', name: 'Tomato', color: 0xe83a2a, emoji: '🍅' },
    { id: 'carrot', name: 'Carrot', color: 0xe87820, emoji: '🥕' },
    { id: 'potato', name: 'Potato', color: 0xa87850, emoji: '🥔' },
    { id: 'corn', name: 'Corn', color: 0xf0c040, emoji: '🌽' },
    { id: 'lettuce', name: 'Lettuce', color: 0x7aba4a, emoji: '🥬' },
    { id: 'strawberry', name: 'Strawberry', color: 0xe83a4a, emoji: '🍓' },
  ];

  const interactables = [];
  seedTypes.forEach((seed, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const jar = new THREE.Group();

    // Jar body
    const jarBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.32, 10),
      MAT.glass
    );
    jarBody.position.y = 0.16;
    jar.add(jarBody);

    // Seeds inside — colored dots
    for (let s = 0; s < 8; s++) {
      const seedDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 5, 4),
        new THREE.MeshStandardMaterial({ color: seed.color, roughness: 0.7 })
      );
      seedDot.position.set(
        (Math.random() - 0.5) * 0.18,
        0.06 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.18
      );
      jar.add(seedDot);
    }

    // Lid (wood)
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10),
      MAT.woodDark
    );
    lid.position.y = 0.34;
    jar.add(lid);

    // Label
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.9 })
    );
    label.position.set(0, 0.18, 0.17);
    jar.add(label);

    jar.position.set(-1.2 + col * 1.2, 0.6 + row * 0.55 + 0.04, -D / 2 + 0.4);
    jar.castShadow = true;

    jar.userData.interact = {
      type: 'take_seed',
      seedId: seed.id,
      seedName: seed.name,
      emoji: seed.emoji,
      prompt: `<span class="key">E</span> Take ${seed.emoji} ${seed.name} seeds`,
    };
    interactables.push(jar);

    group.add(jar);
  });

  // Wooden counter / table outside
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.1, 0.8),
    MAT.woodMed
  );
  counter.position.set(0, 1.0, D / 2 + 0.3);
  counter.castShadow = true;
  group.add(counter);

  for (const [dx, dz] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.08),
      MAT.woodDark
    );
    leg.position.set(dx, 0.55, D / 2 + 0.3 + dz);
    group.add(leg);
  }

  return { group, interactables };
}

// ═══════════════════════════════════════════════════════════════
//  SKY — gradient shader + sun/moon/stars
// ═══════════════════════════════════════════════════════════════
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x5a9bd8) },
      bottomColor: { value: new THREE.Color(0xd8e8f0) },
      sunPos: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xffeecc) },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 sunPos;
      uniform vec3 sunColor;
      uniform float time;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.8));
        float sd = distance(dir, normalize(sunPos));
        col += sunColor * smoothstep(0.35, 0.0, sd) * 0.8;
        // faint stars at night
        float night = smoothstep(0.55, 0.9, 1.0 - h);
        vec3 starDir = floor(dir * 400.0);
        float star = step(0.9985, fract(sin(dot(starDir, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
        col += vec3(star) * night * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Sun
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  scene.add(sun);

  // Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xdde8ff })
  );
  scene.add(moon);

  return { skyMesh, skyMat, sun, moon };
}

// ═══════════════════════════════════════════════════════════════
//  CLOUDS
// ═══════════════════════════════════════════════════════════════
function buildClouds(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const puffGeo = new THREE.SphereGeometry(1, 6, 5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, flatShading: true,
    transparent: true, opacity: 0.82,
  });

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(puffGeo, mat);
      p.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 5
      );
      p.scale.setScalar(1.2 + Math.random() * 1.4);
      cloud.add(p);
    }
    cloud.position.set(
      (Math.random() - 0.5) * 250,
      55 + Math.random() * 15,
      (Math.random() - 0.5) * 250
    );
    cloud.scale.setScalar(2.5 + Math.random() * 2);
    cloud.userData = { speed: 0.3 + Math.random() * 0.4 };
    group.add(cloud);
    clouds.push(cloud);
  }

  return { group, clouds, mat };
}

// ═══════════════════════════════════════════════════════════════
//  GRASS PATCHES — instanced billboards around player
// ═══════════════════════════════════════════════════════════════
function buildGrassPatches(scene) {
  const grassGeo = new THREE.ConeGeometry(0.08, 0.7, 3);
  grassGeo.translate(0, 0.35, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x6a9a4a, roughness: 1, flatShading: true,
  });

  const COUNT = 800;
  const mesh = new THREE.InstancedMesh(grassGeo, grassMat, COUNT);
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const positions = [];
  const phases = [];

  function respawn(i, centerX, centerZ) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 22;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const y = infiniteTerrainHeight(x, z);
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    const s = 0.6 + Math.random() * 1.0;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    positions[i] = { x, y, z, baseRot: dummy.rotation.y, scale: s };
    phases[i] = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < COUNT; i++) {
    respawn(i, 0, 0);
  }
  mesh.instanceMatrix.needsUpdate = true;

  return {
    mesh, positions, phases, dummy, respawn,
    update(elapsed, playerX, playerZ) {
      // Sway
      for (let i = 0; i < COUNT; i++) {
        const p = positions[i];
        if (!p) continue;
        const sway = Math.sin(elapsed * 1.5 + phases[i] + p.x * 0.3) * 0.14;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(sway, p.baseRot, sway * 0.6);
        dummy.scale.set(p.scale, p.scale, p.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      // Respawn far ones near player
      for (let i = 0; i < COUNT; i++) {
        const p = positions[i];
        if (!p) continue;
        const d = Math.hypot(p.x - playerX, p.z - playerZ);
        if (d > 25) respawn(i, playerX, playerZ);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  PARTICLES — ambient dust, pollen, fireflies
// ═══════════════════════════════════════════════════════════════
function buildAmbientParticles(scene) {
  // Dust motes (day)
  const dustCount = 120;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 30;
    dustPos[i * 3 + 1] = Math.random() * 8 + 0.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xfff0d0, size: 0.08, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // Fireflies (night)
  const ffCount = 60;
  const ffGeo = new THREE.BufferGeometry();
  const ffPos = new Float32Array(ffCount * 3);
  for (let i = 0; i < ffCount; i++) {
    ffPos[i * 3] = (Math.random() - 0.5) * 25;
    ffPos[i * 3 + 1] = 0.5 + Math.random() * 2.5;
    ffPos[i * 3 + 2] = (Math.random() - 0.5) * 25;
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xffe888, size: 0.18, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ff = new THREE.Points(ffGeo, ffMat);
  scene.add(ff);

  return { dust, dustGeo, dustMat, ff, ffGeo, ffMat };
}

// ═══════════════════════════════════════════════════════════════
//  WEATHER — rain, snow particles
// ═══════════════════════════════════════════════════════════════
function buildWeather(scene) {
  // Rain
  const rainCount = 800;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  const rainVel = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 40;
    rainPos[i * 3 + 1] = Math.random() * 25;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    rainVel[i] = 15 + Math.random() * 10;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x99ccee, size: 0.08, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  scene.add(rain);

  // Snow
  const snowCount = 400;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 40;
    snowPos[i * 3 + 1] = Math.random() * 25;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.16, transparent: true, opacity: 0,
    depthWrite: false,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  scene.add(snow);

  return { rain, rainGeo, rainMat, rainVel, snow, snowGeo, snowMat };
}

// ═══════════════════════════════════════════════════════════════
//  WORLD FACTORY — everything together
// ═══════════════════════════════════════════════════════════════
export async function createWorld(scene, sunLight, hemiLight) {
  // ── Chunks ────────────────────────────────────────────────
  const chunks = new ChunkManager(scene);

  // ── Buildings ─────────────────────────────────────────────
  const house = buildHouse();
  house.position.set(HOUSE_POS.x, infiniteTerrainHeight(HOUSE_POS.x, HOUSE_POS.z), HOUSE_POS.z);
  scene.add(house);

  const stable = buildStable();
  stable.position.set(STABLE_POS.x, infiniteTerrainHeight(STABLE_POS.x, STABLE_POS.z), STABLE_POS.z);
  scene.add(stable);

  const shed = buildSeedShed();
  shed.group.position.set(SHED_POS.x, infiniteTerrainHeight(SHED_POS.x, SHED_POS.z), SHED_POS.z);
  scene.add(shed.group);

  // ── Paths (dirt paths connecting the buildings) ──────────
  const paths = buildPaths(scene);

  // ── Sky, clouds ──────────────────────────────────────────
  const sky = buildSky(scene);
  const clouds = buildClouds(scene);

  // ── Grass ─────────────────────────────────────────────────
  const grass = buildGrassPatches(scene);

  // ── Particles ─────────────────────────────────────────────
  const ambient = buildAmbientParticles(scene);
  const weather = buildWeather(scene);

  // ── Interaction registry ─────────────────────────────────
  const interactables = [];
  shed.interactables.forEach(o => interactables.push(o));
  house.traverse(o => { if (o.userData.interact) interactables.push(o); });
  stable.traverse(o => { if (o.userData.interact) interactables.push(o); });

  // ── Fence around house garden ────────────────────────────
  buildFenceAroundHouse(scene);

  return {
    chunks,
    house, stable, shed, paths,
    sky, clouds, grass, ambient, weather,
    interactables,

    // Update per frame
    update(dt, elapsed, camera) {
      const px = camera.position.x;
      const pz = camera.position.z;

      // Chunks follow player
      chunks.update(px, pz);

      // Grass
      grass.update(elapsed, px, pz);

      // Clouds drift
      for (const c of clouds.clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 150) c.position.x = -150;
      }

      // Dust + fireflies follow player
      ambient.dust.position.set(px, 0, pz);
      ambient.ff.position.set(px, 0, pz);

      // Particles sway
      const dustArr = ambient.dustGeo.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        dustArr[i * 3] += Math.sin(elapsed * 0.6 + i) * 0.003;
        dustArr[i * 3 + 1] += Math.cos(elapsed * 0.4 + i * 0.7) * 0.002;
        dustArr[i * 3 + 2] += Math.cos(elapsed * 0.5 + i * 0.3) * 0.003;
        if (dustArr[i * 3 + 1] > 9) dustArr[i * 3 + 1] = 0.5;
        if (dustArr[i * 3 + 1] < 0.4) dustArr[i * 3 + 1] = 0.5;
      }
      ambient.dustGeo.attributes.position.needsUpdate = true;

      const ffArr = ambient.ffGeo.attributes.position.array;
      for (let i = 0; i < ffCount; i++) {
        ffArr[i * 3] += Math.sin(elapsed * 1.2 + i * 0.5) * 0.012;
        ffArr[i * 3 + 1] += Math.cos(elapsed * 1.5 + i) * 0.008;
        ffArr[i * 3 + 2] += Math.cos(elapsed * 1.1 + i * 0.7) * 0.01;
      }
      ambient.ffGeo.attributes.position.needsUpdate = true;

      // Weather
      weather.rain.position.set(px, 0, pz);
      weather.snow.position.set(px, 0, pz);

      const rainArr = weather.rainGeo.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        rainArr[i * 3 + 1] -= weather.rainVel[i] * dt;
        if (rainArr[i * 3 + 1] < 0) {
          rainArr[i * 3] = (Math.random() - 0.5) * 40;
          rainArr[i * 3 + 1] = 25 + Math.random() * 5;
          rainArr[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
      }
      weather.rainGeo.attributes.position.needsUpdate = true;

      const snowArr = weather.snowGeo.attributes.position.array;
      for (let i = 0; i < snowCount; i++) {
        snowArr[i * 3 + 1] -= 1.5 * dt;
        snowArr[i * 3] += Math.sin(elapsed * 0.5 + i) * 0.008;
        if (snowArr[i * 3 + 1] < 0) {
          snowArr[i * 3] = (Math.random() - 0.5) * 40;
          snowArr[i * 3 + 1] = 25 + Math.random() * 5;
          snowArr[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
      }
      weather.snowGeo.attributes.position.needsUpdate = true;
    },

    updateTimeOfDay(tod, sunLight, hemiLight, camera) {
      const angle = (tod - 0.25) * Math.PI * 2;
      const sunX = Math.cos(angle) * 150;
      const sunY = Math.sin(angle) * 110;
      const sunZ = -Math.cos(angle) * 50;

      sky.sun.position.set(sunX, sunY, sunZ);
      sky.moon.position.set(-sunX, -sunY + 20, -sunZ);

      // Sky colors
      const night = new THREE.Color(0x0a1530);
      const dawn = new THREE.Color(0xffb070);
      const dusk = new THREE.Color(0xff8850);
      const noon = new THREE.Color(0x5a9bd8);
      const skyLow = new THREE.Color(0xd8e8f0);

      let top, bot, sunCol;

      if (tod < 0.2) {
        top = night.clone();
        bot = new THREE.Color(0x1a2a50);
        sunCol = new THREE.Color(0x4a6a9a);
      } else if (tod < 0.28) {
        const k = (tod - 0.2) / 0.08;
        top = night.clone().lerp(dawn, k);
        bot = new THREE.Color(0x1a2a50).lerp(dawn, k);
        sunCol = new THREE.Color(0x4a6a9a).lerp(dawn, k);
      } else if (tod < 0.72) {
        const k = Math.abs(tod - 0.5) / 0.22;
        top = noon.clone().lerp(new THREE.Color(0x4a8bc8), k * 0.3);
        bot = skyLow.clone();
        sunCol = new THREE.Color(0xfff2d0);
      } else if (tod < 0.82) {
        const k = (tod - 0.72) / 0.10;
        top = new THREE.Color(0x5a9bd8).lerp(dusk, k);
        bot = new THREE.Color(0xd8e8f0).lerp(dusk, k);
        sunCol = new THREE.Color(0xfff2d0).lerp(dusk, k);
      } else {
        const k = (tod - 0.82) / 0.18;
        top = dusk.clone().lerp(night, k);
        bot = dusk.clone().lerp(new THREE.Color(0x1a2a50), k);
        sunCol = dusk.clone().lerp(new THREE.Color(0x4a6a9a), k);
      }

      sky.skyMat.uniforms.topColor.value.copy(top);
      sky.skyMat.uniforms.bottomColor.value.copy(bot);
      sky.skyMat.uniforms.sunColor.value.copy(sunCol);
      sky.skyMat.uniforms.sunPos.value.copy(sky.sun.position).normalize();

      // Lights
      const dayness = Math.max(0, Math.min(1, 1 - Math.abs(tod - 0.5) * 3));
      sunLight.position.copy(sky.sun.position);
      sunLight.target.position.set(camera.position.x, 0, camera.position.z);
      sunLight.target.updateMatrixWorld();
      sunLight.color.copy(sunCol);
      sunLight.intensity = 0.18 + dayness * 1.5;
      hemiLight.intensity = 0.3 + dayness * 0.85;

      // Ambient dust opacity (day)
      ambient.dustMat.opacity = 0.5 * dayness;
      // Fireflies opacity (night)
      ambient.ffMat.opacity = (1 - dayness) * 0.7;

      // Sun/moon visibility
      sky.sun.material.color.setHex(tod < 0.25 || tod > 0.75 ? 0xdde8ff : 0xffe8a0);
    },

    setWeather(weatherType, intensity = 1) {
      weather.rainMat.opacity = weatherType === 'rain' ? 0.4 * intensity : weatherType === 'storm' ? 0.6 * intensity : 0;
      weather.snowMat.opacity = weatherType === 'snow' ? 0.6 * intensity : 0;
      clouds.mat.opacity = weatherType === 'clear' ? 0.82 : weatherType === 'cloudy' ? 0.95 : 0.98;
      clouds.mat.color.setHex(weatherType === 'storm' ? 0x707080 : weatherType === 'rain' ? 0x9090a0 : 0xffffff);
    },

    getInteractables() {
      return interactables;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  PATHS — dirt paths connecting buildings
// ═══════════════════════════════════════════════════════════════
function buildPaths(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Path from spawn to house (straight line)
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a4a, roughness: 0.98,
  });

  function makePathSegment(x1, z1, x2, z2, width = 1.4) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;

    // Sample multiple points along path to follow terrain
    const segments = Math.ceil(length / 2);
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      const px1 = x1 + dx * t1;
      const pz1 = z1 + dz * t1;
      const px2 = x1 + dx * t2;
      const pz2 = z1 + dz * t2;

      const segDx = px2 - px1;
      const segDz = pz2 - pz1;
      const segLen = Math.sqrt(segDx * segDx + segDz * segDz);

      const geo = new THREE.PlaneGeometry(width, segLen + 0.1);
      geo.rotateX(-Math.PI / 2);

      // Deform to terrain
      const pos = geo.attributes.position;
      const centerX = (px1 + px2) / 2;
      const centerZ = (pz1 + pz2) / 2;
      const angle = Math.atan2(segDx, segDz);

      // Move plane vertices to match segment position
      for (let v = 0; v < pos.count; v++) {
        const lx = pos.getX(v);
        const lz = pos.getZ(v);
        // rotate around center
        const rotatedX = lx * Math.cos(angle) - lz * Math.sin(angle);
        const rotatedZ = lx * Math.sin(angle) + lz * Math.cos(angle);
        const wx = centerX + rotatedX;
        const wz = centerZ + rotatedZ;
        pos.setX(v, wx);
        pos.setZ(v, wz);
        pos.setY(v, infiniteTerrainHeight(wx, wz) + 0.03);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, pathMat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Main path from spawn to house
  makePathSegment(0, 8, 0, HOUSE_POS.z + 6, 1.6);
  // Path to stable
  makePathSegment(0, 0, STABLE_POS.x - 4, STABLE_POS.z + 2, 1.2);
  // Path to shed
  makePathSegment(0, 0, SHED_POS.x + 4, SHED_POS.z + 2, 1.2);

  return group;
}

// ═══════════════════════════════════════════════════════════════
//  FENCE around house garden
// ═══════════════════════════════════════════════════════════════
function buildFenceAroundHouse(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const fenceMat = MAT.woodDark;
  const postGeo = new THREE.BoxGeometry(0.15, 1.1, 0.15);
  const railGeo = new THREE.BoxGeometry(2, 0.08, 0.08);

  // A simple rectangular fence in front of house (the garden area)
  const gx1 = -8, gx2 = 8, gz1 = 5, gz2 = 14;

  // Left fence
  for (let z = gz1; z < gz2; z += 2) {
    const x = gx1;
    const y = infiniteTerrainHeight(x, z);
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(x, y + 0.55, z);
    post.castShadow = true;
    group.add(post);

    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.position.set(x, y + 0.6, z + 1);
    rail.rotation.y = Math.PI / 2;
    group.add(rail);
  }
  // Right fence
  for (let z = gz1; z < gz2; z += 2) {
    const x = gx2;
    const y = infiniteTerrainHeight(x, z);
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(x, y + 0.55, z);
    post.castShadow = true;
    group.add(post);

    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.position.set(x, y + 0.6, z + 1);
    rail.rotation.y = Math.PI / 2;
    group.add(rail);
  }
  // Back fence (no gate — house blocks)
  for (let x = gx1; x < gx2; x += 2) {
    const z = gz2;
    const y = infiniteTerrainHeight(x, z);
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(x, y + 0.55, z);
    post.castShadow = true;
    group.add(post);

    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.position.set(x + 1, y + 0.6, z);
    group.add(rail);
  }
  // Front fence — with a gap in the middle for the gate
  for (let x = gx1; x < gx2; x += 2) {
    if (x > -1 && x < 1) continue; // gate gap
    const z = gz1;
    const y = infiniteTerrainHeight(x, z);
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(x, y + 0.55, z);
    post.castShadow = true;
    group.add(post);

    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.position.set(x + 1, y + 0.6, z);
    group.add(rail);
  }

  return group;
}

// Constants for particle counts (used in update)
const dustCount = 120;
const ffCount = 60;
const rainCount = 800;
const snowCount = 400;

// ═══════════════════════════════════════════════════════════════
//  INTERACTION HANDLER — called by engine when player interacts
// ═══════════════════════════════════════════════════════════════
export function handleInteraction(target) {
  if (!target || !target.userData?.interact) return;
  const inter = target.userData.interact;
  const player = gameState.player;

  switch (inter.type) {
    case 'take_seed': {
      const seedId = inter.seedId;
      // Seeds cost coins
      const costs = { tomato: 5, carrot: 4, potato: 6, corn: 8, lettuce: 5, strawberry: 10 };
      const cost = costs[seedId] || 5;
      if (player.coins < cost) {
        HUD.showToast(`Need ${cost}🪙 for ${inter.seedName} seeds`);
        return;
      }
      player.coins -= cost;
      player.seeds[seedId] = (player.seeds[seedId] || 0) + 1;
      player.heldItem = 'seed_' + seedId;
      Audio.playTone(720, 0.15, 'sine', 0.06);
      HUD.showToast(`Took ${inter.emoji} ${inter.seedName} seed — ${cost}🪙`);
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    }

    case 'feed_horse': {
      // Drop 4 will handle horse
      player.heldItem = 'hay';
      HUD.showToast('Grabbed hay 🌾');
      Audio.playTone(400, 0.1, 'triangle', 0.05);
      break;
    }

    case 'refill_water': {
      player.water = player.waterMax;
      Audio.playWaterSplash();
      HUD.showToast('Watering can filled 💧');
      window.dispatchEvent(new CustomEvent('hud-refresh'));
      break;
    }

    case 'rest': {
      // Restore small amount of stamina (no stamina system yet, but store it)
      HUD.showToast('You rest a moment…');
      Audio.playTone(440, 0.5, 'sine', 0.04);
      break;
    }

    case 'sleep': {
      // Skip to next morning
      gameState.world.timeOfDay = 0.28;
      gameState.world.day++;
      HUD.showToast(`🌅 Day ${gameState.world.day} — rested well`);
      Audio.playTone(523, 0.8, 'sine', 0.05);
      setTimeout(() => Audio.playTone(659, 0.8, 'sine', 0.04), 200);
      setTimeout(() => Audio.playTone(784, 1.0, 'sine', 0.03), 400);
      break;
    }

    default:
      break;
  }

  // Sync HUD
  if (window.__hudRef?.refresh) window.__hudRef.refresh();
}