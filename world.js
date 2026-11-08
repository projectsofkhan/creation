// ═══════════════════════════════════════════════════════════════
//  world.js — v2.1 (merge-safe)
//  Replaces: world.js (all prior versions)
//
//  Fixes in v2.1:
//  • toNonIndexed() on all merged geometries (fixes crash)
//  • Null guards after every mergeGeometries() call
//  • Safe disposal even when merge fails
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainHeight, terrainNormal, WATER_LEVEL, CHUNK_SIZE, CHUNK_SEGMENTS } from './terrain.js';

// ═══════════════════════════════════════════════════════════════
//  POSITIONS
// ═══════════════════════════════════════════════════════════════
const HOUSE_POS = { x: 0, z: -18 };
const STABLE_POS = { x: 6, z: -6 };
const SHED_POS = { x: -14, z: -8 };

// ═══════════════════════════════════════════════════════════════
//  MATERIALS (local — building-only)
// ═══════════════════════════════════════════════════════════════
const MAT = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 0.94 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.97 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xa88860, roughness: 0.88 }),
  woodMed: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.92 }),
  roofRed: new THREE.MeshStandardMaterial({ color: 0xa8483a, roughness: 0.8 }),
  roofThatch: new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.95 }),
  roofBrown: new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.88 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 0.92 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.94 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x88b0d0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.72 }),
  windowFrame: new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x6a6a70, roughness: 0.5, metalness: 0.8 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xb8a880, roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.9 }),
  leafDark: new THREE.MeshStandardMaterial({ color: 0x356a28, roughness: 0.92 }),
  leafLight: new THREE.MeshStandardMaterial({ color: 0x6aba4a, roughness: 0.88 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.96 }),
  bush: new THREE.MeshStandardMaterial({ color: 0x4a7a38, roughness: 0.92 }),
  flowerPink: new THREE.MeshStandardMaterial({ color: 0xffa8c8, roughness: 0.7 }),
  flowerYellow: new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.7 }),
  flowerWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  flowerPurple: new THREE.MeshStandardMaterial({ color: 0xc88aff, roughness: 0.7 }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x3a7a9a, roughness: 0.08, metalness: 0.2,
    transmission: 0.6, thickness: 0.5, ior: 1.33,
    transparent: true, opacity: 0.88,
  }),
  hay: new THREE.MeshStandardMaterial({ color: 0xc8a850, roughness: 0.95 }),
};

// ═══════════════════════════════════════════════════════════════
//  WATER NORMAL MAP
// ═══════════════════════════════════════════════════════════════
function makeWaterNormalMap() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = Math.sin(x * 0.15 + Math.cos(y * 0.1) * 2) * 0.5 + 0.5;
      const ny = Math.cos(y * 0.13 + Math.sin(x * 0.09) * 2) * 0.5 + 0.5;
      img.data[i] = nx * 255;
      img.data[i + 1] = ny * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

// ═══════════════════════════════════════════════════════════════
//  CHUNK MANAGER — async queue, merge-safe
// ═══════════════════════════════════════════════════════════════
class ChunkManager {
  constructor(scene, viewRadius) {
    this.scene = scene;
    this.viewRadius = viewRadius;
    this.chunks = new Map();
    this.queue = [];
    this.center = { x: 999, z: 999 };
    this.maxPerFrame = 2;
    this.waterNormal = makeWaterNormalMap();
    if (MAT.water) {
      MAT.water.normalMap = this.waterNormal;
      MAT.water.normalScale = new THREE.Vector2(0.4, 0.4);
    }
  }

  key(cx, cz) { return `${cx},${cz}`; }

  update(playerX, playerZ) {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cz = Math.floor(playerZ / CHUNK_SIZE);
    if (cx === this.center.x && cz === this.center.z) {
      this.drainQueue();
      return;
    }
    this.center = { x: cx, z: cz };

    const keep = new Set();
    for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
      for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
        keep.add(this.key(cx + dx, cz + dz));
      }
    }
    for (const k of this.chunks.keys()) {
      if (!keep.has(k)) this.unloadChunk(k);
    }

    const toBuild = [];
    for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
      for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
        const k = this.key(cx + dx, cz + dz);
        if (!this.chunks.has(k) && !this.queue.includes(k)) {
          toBuild.push({ k, cx: cx + dx, cz: cz + dz, d: dx * dx + dz * dz });
        }
      }
    }
    toBuild.sort((a, b) => a.d - b.d);
    for (const t of toBuild) this.queue.push(t);

    this.drainQueue();
  }

  drainQueue() {
    let built = 0;
    while (this.queue.length && built < this.maxPerFrame) {
      const { k, cx, cz } = this.queue.shift();
      if (!this.chunks.has(k)) {
        this.buildChunk(cx, cz, k);
        built++;
      }
    }
  }

  unloadChunk(k) {
    const c = this.chunks.get(k);
    if (!c) return;
    for (const mesh of Object.values(c)) {
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry?.dispose();
      }
    }
    this.chunks.delete(k);
  }

  buildChunk(cx, cz, key) {
    const terrain = this.buildTerrain(cx, cz);
    const trees = this.buildTrees(cx, cz);
    const bushes = this.buildBushes(cx, cz);
    const flowers = this.buildFlowers(cx, cz);

    if (terrain) this.scene.add(terrain);
    if (trees) this.scene.add(trees);
    if (bushes) this.scene.add(bushes);
    if (flowers) this.scene.add(flowers);

    this.chunks.set(key, { terrain, trees, bushes, flowers });
  }

  // ── Terrain mesh with smooth normals ────────────────────────
  buildTerrain(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const normals = new Float32Array(pos.count * 3);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let i = 0; i < pos.count; i++) {
      const wx = baseX + pos.getX(i);
      const wz = baseZ + pos.getZ(i);
      const h = terrainHeight(wx, wz);
      pos.setY(i, h);

      const n = Math.sin(wx * 0.06) * Math.cos(wz * 0.06) * 0.5 + 0.5;
      let r, g, b;
      if (h < WATER_LEVEL) { r = 0.32 + n * 0.1; g = 0.40 + n * 0.1; b = 0.28 + n * 0.08; }
      else if (h < 3)      { r = 0.28 + n * 0.22; g = 0.52 + n * 0.20; b = 0.22 + n * 0.12; }
      else if (h < 8)      { r = 0.35 + n * 0.20; g = 0.50 + n * 0.15; b = 0.28 + n * 0.12; }
      else                 { r = 0.52 + n * 0.18; g = 0.54 + n * 0.14; b = 0.50 + n * 0.12; }
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;

      const nrm = terrainNormal(wx, wz);
      normals[i * 3] = nrm.x;
      normals[i * 3 + 1] = nrm.y;
      normals[i * 3 + 2] = nrm.z;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(baseX, 0, baseZ);
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── Merged trees ────────────────────────────────────────────
  buildTrees(cx, cz) {
    let r = Math.abs((cx * 73856093) ^ (cz * 19349663)) % 100000;
    const nextRand = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
    const treeCount = 4 + Math.floor(nextRand() * 5);

    const trunkGeos = [];
    const leafGeos = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
      const lx = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const lz = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;

      if (Math.hypot(wx - HOUSE_POS.x, wz - HOUSE_POS.z) < 14) continue;
      if (Math.hypot(wx - STABLE_POS.x, wz - STABLE_POS.z) < 8) continue;
      if (Math.hypot(wx - SHED_POS.x, wz - SHED_POS.z) < 8) continue;

      const h = terrainHeight(wx, wz);
      if (h < WATER_LEVEL + 0.3 || h > 8) continue;

      const scale = 0.8 + nextRand() * 0.9;
      const trunkH = 3.5 * scale;

      // Trunk — non-indexed for safe merging
      dummy.position.set(wx, h + trunkH / 2, wz);
      dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
      dummy.scale.set(scale, 1, scale);
      dummy.updateMatrix();
      const trunkGeo = new THREE.CylinderGeometry(0.22 * scale, 0.36 * scale, trunkH, 7).toNonIndexed();
      trunkGeo.applyMatrix4(dummy.matrix);
      trunkGeos.push(trunkGeo);

      // Foliage — non-indexed cones
      for (let j = 0; j < 3; j++) {
        const rad = (1.5 - j * 0.3) * scale;
        const coneGeo = new THREE.ConeGeometry(rad, rad * 1.4, 7).toNonIndexed();
        dummy.position.set(wx, h + trunkH * 0.7 + j * 0.85 * scale, wz);
        dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        coneGeo.applyMatrix4(dummy.matrix);
        leafGeos.push(coneGeo);
      }
    }

    if (!trunkGeos.length) {
      leafGeos.forEach(g => g.dispose());
      return null;
    }

    const trunkMerged = mergeGeometries(trunkGeos, false);
    const leafMerged = mergeGeometries(leafGeos, false);
    trunkGeos.forEach(g => g.dispose());
    leafGeos.forEach(g => g.dispose());
    if (!trunkMerged || !leafMerged) {
      trunkMerged?.dispose();
      leafMerged?.dispose();
      return null;
    }

    const combined = mergeGeometries([trunkMerged, leafMerged], true);
    trunkMerged.dispose();
    leafMerged.dispose();
    if (!combined) return null;

    const mesh = new THREE.Mesh(combined, [MAT.bark, MAT.leaf]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── Merged bushes ───────────────────────────────────────────
  buildBushes(cx, cz) {
    let r = Math.abs((cx * 19349663) ^ (cz * 83492791)) % 100000;
    const nextRand = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
    const count = 2 + Math.floor(nextRand() * 3);
    const geos = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const lx = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const lz = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const h = terrainHeight(wx, wz);
      if (h < WATER_LEVEL + 0.2 || h > 6) continue;

      const scale = 0.6 + nextRand() * 0.4;
      const geo = new THREE.IcosahedronGeometry(scale, 1).toNonIndexed();
      dummy.position.set(wx, h + scale * 0.6, wz);
      dummy.rotation.set(nextRand() * 0.3, nextRand() * Math.PI * 2, nextRand() * 0.3);
      dummy.scale.set(1, 0.8, 1);
      dummy.updateMatrix();
      geo.applyMatrix4(dummy.matrix);
      geos.push(geo);
    }

    if (!geos.length) return null;
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, MAT.bush);
    mesh.castShadow = true;
    return mesh;
  }

  // ── Merged flowers — FIXED ──────────────────────────────────
  buildFlowers(cx, cz) {
    let r = Math.abs((cx * 49287673) ^ (cz * 83492791)) % 100000;
    const nextRand = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
    const count = 3 + Math.floor(nextRand() * 5);
    const headGeos = [];
    const stemGeos = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const lx = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const lz = nextRand() * CHUNK_SIZE - CHUNK_SIZE / 2;
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const h = terrainHeight(wx, wz);
      if (h < WATER_LEVEL + 0.1 || h > 5) continue;

      const scale = 0.12 + nextRand() * 0.06;
      const stemH = 0.3;

      // Stem — force non-indexed
      dummy.position.set(wx, h + stemH / 2, wz);
      dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, stemH, 4).toNonIndexed();
      stemGeo.applyMatrix4(dummy.matrix);
      stemGeos.push(stemGeo);

      // Head — non-indexed
      dummy.position.set(wx, h + stemH + scale * 0.5, wz);
      dummy.rotation.set(nextRand() * 0.4, nextRand() * Math.PI * 2, nextRand() * 0.4);
      dummy.updateMatrix();
      const headGeo = new THREE.IcosahedronGeometry(scale, 0).toNonIndexed();
      headGeo.applyMatrix4(dummy.matrix);
      headGeos.push(headGeo);
    }

    if (!headGeos.length) {
      stemGeos.forEach(g => g.dispose());
      return null;
    }

    const headMerged = mergeGeometries(headGeos, false);
    const stemMerged = mergeGeometries(stemGeos, false);
    headGeos.forEach(g => g.dispose());
    stemGeos.forEach(g => g.dispose());
    if (!headMerged || !stemMerged) {
      headMerged?.dispose();
      stemMerged?.dispose();
      return null;
    }

    const combined = mergeGeometries([headMerged, stemMerged], true);
    headMerged.dispose();
    stemMerged.dispose();
    if (!combined) return null;

    const mesh = new THREE.Mesh(combined, [MAT.flowerPink, MAT.leaf]);
    return mesh;
  }
}

// ═══════════════════════════════════════════════════════════════
//  BUILDINGS
// ═══════════════════════════════════════════════════════════════
function buildHouse() {
  const group = new THREE.Group();
  const W = 9, D = 11, H = 3.8;
  const t = 0.25;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), MAT.stone);
  base.position.y = 0.25; base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), MAT.woodMed);
  floor.position.y = 0.56; floor.receiveShadow = true;
  group.add(floor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), MAT.woodLight);
  backWall.position.set(0, 0.5 + H / 2, -D / 2 + t / 2);
  backWall.castShadow = true; backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), MAT.woodLight);
  leftWall.position.set(-W / 2 + t / 2, 0.5 + H / 2, 0);
  leftWall.castShadow = true; leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), MAT.woodLight);
  rightWall.position.set(W / 2 - t / 2, 0.5 + H / 2, 0);
  rightWall.castShadow = true; rightWall.receiveShadow = true;
  group.add(rightWall);

  const doorW = 1.6, doorH = 2.4;
  const flW = (W - doorW) / 2;
  for (const side of [-1, 1]) {
    const fw = new THREE.Mesh(new THREE.BoxGeometry(flW, H, t), MAT.woodLight);
    fw.position.set(side * (W / 2 - flW / 2), 0.5 + H / 2, D / 2 - t / 2);
    fw.castShadow = true; fw.receiveShadow = true;
    group.add(fw);
  }
  const ft = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - doorH, t), MAT.woodLight);
  ft.position.set(0, 0.5 + doorH + (H - doorH) / 2, D / 2 - t / 2);
  ft.castShadow = true;
  group.add(ft);

  const roofGeo = new THREE.ConeGeometry(W * 0.78, 2.8, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MAT.roofRed);
  roof.position.y = 0.5 + H + 1.4;
  roof.castShadow = true; roof.receiveShadow = true;
  group.add(roof);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), MAT.stoneDark);
  chimney.position.set(W * 0.32, 0.5 + H + 1.5, -D * 0.22);
  chimney.castShadow = true;
  group.add(chimney);

  const light = new THREE.PointLight(0xffd8a0, 1.2, 12, 2);
  light.position.set(0, 2.2, 0);
  group.add(light);

  return { group, collider: { w: W, d: D, h: H } };
}

function buildStable() {
  const group = new THREE.Group();
  const W = 6, D = 5, H = 3.2;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.2, D + 0.3), MAT.stone);
  base.position.y = 0.1; base.receiveShadow = true;
  group.add(base);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), MAT.hay);
  floor.position.y = 0.23; floor.receiveShadow = true;
  group.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), MAT.woodMed);
  back.position.set(0, H / 2 + 0.2, -D / 2 + 0.1);
  back.castShadow = true; back.receiveShadow = true;
  group.add(back);

  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), MAT.woodMed);
    w.position.set(side * (W / 2 - 0.1), H / 2 + 0.2, 0);
    w.castShadow = true; w.receiveShadow = true;
    group.add(w);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.15, D + 1.2), MAT.roofBrown);
  roof.position.set(0, H + 0.3, 0.1);
  roof.rotation.x = -0.15;
  roof.castShadow = true; roof.receiveShadow = true;
  group.add(roof);

  const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), MAT.hay);
  hay.rotation.z = Math.PI / 2;
  hay.position.set(-W / 2 + 1.2, 0.85, -D / 2 + 1.0);
  hay.castShadow = true;
  hay.userData.interact = {
    type: 'feed_horse',
    prompt: '<span class="key">E</span> Grab hay 🌾',
  };
  group.add(hay);

  return { group, collider: { w: W, d: D, h: H } };
}

function buildShed() {
  const group = new THREE.Group();
  const W = 4.5, D = 3.5, H = 2.6;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.2, D + 0.3), MAT.stone);
  base.position.y = 0.1; base.receiveShadow = true;
  group.add(base);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.08, D), MAT.woodMed);
  floor.position.y = 0.24; floor.receiveShadow = true;
  group.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), MAT.woodLight);
  back.position.set(0, H / 2 + 0.2, -D / 2 + 0.1);
  back.castShadow = true; back.receiveShadow = true;
  group.add(back);

  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), MAT.woodLight);
    w.position.set(side * (W / 2 - 0.1), H / 2 + 0.2, 0);
    w.castShadow = true; w.receiveShadow = true;
    group.add(w);
  }

  const roofGeo = new THREE.ConeGeometry(3.4, 1.6, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeo, MAT.roofThatch);
  roof.position.y = H + 1.0;
  roof.castShadow = true; roof.receiveShadow = true;
  group.add(roof);

  const light = new THREE.PointLight(0xffe0a0, 0.7, 6, 2);
  light.position.set(0, 1.8, 0);
  group.add(light);

  // Seed jars — non-indexed merge
  const jarGeos = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = -1.2 + col * 1.2, y = 0.7 + row * 0.55, z = -D / 2 + 0.4;
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.32, 10).toNonIndexed();
    dummy.position.set(x, y + 0.16, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    bodyGeo.applyMatrix4(dummy.matrix);
    jarGeos.push(bodyGeo);
  }
  const jarMerged = mergeGeometries(jarGeos, false);
  jarGeos.forEach(g => g.dispose());
  if (jarMerged) {
    const jarMesh = new THREE.Mesh(jarMerged, MAT.glass);
    group.add(jarMesh);
  }

  const jarTarget = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.8, 0.6, 0.4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  jarTarget.position.set(0, 0.8, -D / 2 + 0.4);
  jarTarget.userData.interact = {
    type: 'open_seeds',
    prompt: '<span class="key">E</span> Browse seeds 🌱',
  };
  group.add(jarTarget);

  return { group, collider: { w: W, d: D, h: H } };
}

// ═══════════════════════════════════════════════════════════════
//  SKY
// ═══════════════════════════════════════════════════════════════
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x5a9bd8) },
      bottomColor: { value: new THREE.Color(0xd8e8f0) },
      horizonColor: { value: new THREE.Color(0xe8f0f8) },
      sunPos: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xffeecc) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, bottomColor, horizonColor, sunColor, sunPos;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(bottomColor, topColor, pow(max(0.0, h - 0.3) / 0.7, 0.85));
        float horizon = smoothstep(0.15, 0.0, abs(dir.y));
        col = mix(col, horizonColor, horizon * 0.5);
        float sd = distance(dir, normalize(sunPos));
        col += sunColor * smoothstep(0.35, 0.0, sd) * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  const starCount = 800;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.9);
    const r = 280;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0 })
  );
  scene.add(sun);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xdde8ff })
  );
  scene.add(moon);

  return { skyMesh, skyMat, sun, moon, stars, starMat };
}

// ═══════════════════════════════════════════════════════════════
//  CLOUDS
// ═══════════════════════════════════════════════════════════════
function buildClouds(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75,
    depthWrite: false, side: THREE.DoubleSide,
  });

  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const geo = new THREE.PlaneGeometry(12, 6);
      const mesh = new THREE.Mesh(geo, cloudMat);
      mesh.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 6
      );
      mesh.rotation.y = Math.random() * Math.PI;
      cloud.add(mesh);
    }
    cloud.position.set(
      (Math.random() - 0.5) * 250,
      55 + Math.random() * 15,
      (Math.random() - 0.5) * 250
    );
    cloud.scale.setScalar(1.5 + Math.random() * 1.5);
    cloud.userData = { speed: 0.3 + Math.random() * 0.4 };
    group.add(cloud);
    clouds.push(cloud);
  }
  return { group, clouds, mat: cloudMat };
}

// ═══════════════════════════════════════════════════════════════
//  POND
// ═══════════════════════════════════════════════════════════════
function buildPond(scene, x, z) {
  const group = new THREE.Group();
  scene.add(group);

  const y = WATER_LEVEL;

  const waterGeo = new THREE.CircleGeometry(5.5, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, MAT.water);
  water.position.set(x, y, z);
  group.add(water);

  const foamGeo = new THREE.RingGeometry(5.3, 5.9, 40);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
  });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(x, y + 0.02, z);
  group.add(foam);

  const bankGeo = new THREE.RingGeometry(5.8, 6.8, 40);
  bankGeo.rotateX(-Math.PI / 2);
  const bank = new THREE.Mesh(bankGeo, MAT.dirt);
  bank.position.set(x, y + 0.05, z);
  group.add(bank);

  return { group, water, foam, foamMat, x, y, z };
}

// ═══════════════════════════════════════════════════════════════
//  PATHS
// ═══════════════════════════════════════════════════════════════
function buildPaths(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.98 });

  function seg(x1, z1, x2, z2, width = 1.4) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 2);
    const ang = Math.atan2(dx, dz);

    for (let i = 0; i < steps; i++) {
      const t1 = i / steps, t2 = (i + 1) / steps;
      const cx = x1 + dx * (t1 + t2) / 2;
      const cz = z1 + dz * (t1 + t2) / 2;
      const sl = len / steps + 0.1;

      const geo = new THREE.PlaneGeometry(width, sl);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const lx = pos.getX(v), lz = pos.getZ(v);
        const rx = lx * Math.cos(ang) - lz * Math.sin(ang);
        const rz = lx * Math.sin(ang) + lz * Math.cos(ang);
        const wx = cx + rx, wz = cz + rz;
        pos.setX(v, wx);
        pos.setZ(v, wz);
        pos.setY(v, terrainHeight(wx, wz) + 0.03);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, pathMat);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  seg(0, 8, 0, HOUSE_POS.z + 6, 1.6);
  seg(0, 0, STABLE_POS.x - 2, STABLE_POS.z + 1, 1.2);
  seg(0, 0, SHED_POS.x + 2, SHED_POS.z + 1, 1.2);

  return group;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN FACTORY
// ═══════════════════════════════════════════════════════════════
export async function createWorld(scene, sunLight, hemiLight, opts = {}) {
  const { Q, prog = () => {} } = opts;
  const viewRadius = Q?.view ?? 3;

  const chunks = new ChunkManager(scene, viewRadius);

  prog(38, 'building house');
  const house = buildHouse();
  house.group.position.set(
    HOUSE_POS.x, terrainHeight(HOUSE_POS.x, HOUSE_POS.z), HOUSE_POS.z
  );
  scene.add(house.group);

  prog(44, 'building stable');
  const stable = buildStable();
  stable.group.position.set(
    STABLE_POS.x, terrainHeight(STABLE_POS.x, STABLE_POS.z), STABLE_POS.z
  );
  scene.add(stable.group);

  prog(50, 'building shed');
  const shed = buildShed();
  shed.group.position.set(
    SHED_POS.x, terrainHeight(SHED_POS.x, SHED_POS.z), SHED_POS.z
  );
  scene.add(shed.group);

  prog(54, 'laying paths');
  buildPaths(scene);

  prog(58, 'painting sky');
  const sky = buildSky(scene);
  const clouds = buildClouds(scene);

  prog(62, 'filling pond');
  const pond = buildPond(scene, -10, 6);

  const interactables = [];
  stable.group.traverse(o => { if (o.userData.interact) interactables.push(o); });
  shed.group.traverse(o => { if (o.userData.interact) interactables.push(o); });

  prog(66, 'growing world');
  chunks.update(0, 0);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const k = chunks.key(dx, dz);
      if (!chunks.chunks.has(k)) chunks.buildChunk(dx, dz, k);
    }
  }
  chunks.center = { x: 0, z: 0 };

  function buildCollision(Collision) {
    Collision.clear();

    const boxes = [
      { pos: HOUSE_POS, col: house.collider },
      { pos: STABLE_POS, col: stable.collider },
      { pos: SHED_POS, col: shed.collider },
    ];

    for (const { pos, col } of boxes) {
      const y = terrainHeight(pos.x, pos.z);
      Collision.add({
        minX: pos.x - col.w / 2,
        maxX: pos.x + col.w / 2,
        minZ: pos.z - col.d / 2,
        maxZ: pos.z + col.d / 2,
        minY: y,
        maxY: y + col.h,
      });
    }

    for (let x = -40; x <= 40; x += 4) {
      for (let z = -40; z <= 40; z += 4) {
        const h = terrainHeight(x, z);
        if (h < WATER_LEVEL + 0.3 || h > 8) continue;
        if (Math.hypot(x - HOUSE_POS.x, z - HOUSE_POS.z) < 14) continue;
        if (Math.hypot(x - STABLE_POS.x, z - STABLE_POS.z) < 8) continue;
        if (Math.hypot(x - SHED_POS.x, z - SHED_POS.z) < 8) continue;
        if (Math.abs(x) < 6 && Math.abs(z) < 10) continue;
        if (Math.random() < 0.15) {
          Collision.add({
            minX: x - 0.4, maxX: x + 0.4,
            minZ: z - 0.4, maxZ: z + 0.4,
            minY: h, maxY: h + 4,
          });
        }
      }
    }

    Collision.add({
      minX: pond.x - 5.5, maxX: pond.x + 5.5,
      minZ: pond.z - 5.5, maxZ: pond.z + 5.5,
      minY: WATER_LEVEL - 2, maxY: WATER_LEVEL,
    });
  }

  let lastSunAngle = 0;

  function updateTimeOfDay(tod, sunLightRef, hemiLightRef, camera, sceneRef) {
    const angle = (tod - 0.25) * Math.PI * 2;
    const sunX = Math.cos(angle) * 150;
    const sunY = Math.sin(angle) * 110;
    const sunZ = -Math.cos(angle) * 50;

    sky.sun.position.set(sunX, sunY, sunZ);
    sky.moon.position.set(-sunX, -sunY + 20, -sunZ);

    const night = new THREE.Color(0x0a1530);
    const dawn = new THREE.Color(0xffb070);
    const dusk = new THREE.Color(0xff8850);
    const noon = new THREE.Color(0x5a9bd8);
    const skyLow = new THREE.Color(0xd8e8f0);
    const horizon = new THREE.Color(0xe8f0f8);

    let top, bot, sunCol, horCol;

    if (tod < 0.2) {
      top = night.clone(); bot = new THREE.Color(0x1a2a50);
      horCol = new THREE.Color(0x1a2a50); sunCol = new THREE.Color(0x4a6a9a);
    } else if (tod < 0.28) {
      const k = (tod - 0.2) / 0.08;
      top = night.clone().lerp(dawn, k);
      bot = new THREE.Color(0x1a2a50).lerp(dawn, k);
      horCol = new THREE.Color(0x1a2a50).lerp(dawn, k);
      sunCol = new THREE.Color(0x4a6a9a).lerp(dawn, k);
    } else if (tod < 0.72) {
      const k = Math.abs(tod - 0.5) / 0.22;
      top = noon.clone().lerp(new THREE.Color(0x4a8bc8), k * 0.3);
      bot = skyLow.clone(); horCol = horizon.clone();
      sunCol = new THREE.Color(0xfff2d0);
    } else if (tod < 0.82) {
      const k = (tod - 0.72) / 0.10;
      top = new THREE.Color(0x5a9bd8).lerp(dusk, k);
      bot = new THREE.Color(0xd8e8f0).lerp(dusk, k);
      horCol = horizon.clone().lerp(dusk, k);
      sunCol = new THREE.Color(0xfff2d0).lerp(dusk, k);
    } else {
      const k = (tod - 0.82) / 0.18;
      top = dusk.clone().lerp(night, k);
      bot = dusk.clone().lerp(new THREE.Color(0x1a2a50), k);
      horCol = dusk.clone().lerp(new THREE.Color(0x1a2a50), k);
      sunCol = dusk.clone().lerp(new THREE.Color(0x4a6a9a), k);
    }

    sky.skyMat.uniforms.topColor.value.copy(top);
    sky.skyMat.uniforms.bottomColor.value.copy(bot);
    sky.skyMat.uniforms.horizonColor.value.copy(horCol);
    sky.skyMat.uniforms.sunColor.value.copy(sunCol);
    sky.skyMat.uniforms.sunPos.value.copy(sky.sun.position).normalize();

    if (sceneRef?.fog) sceneRef.fog.color.copy(horCol);

    const dayness = Math.max(0, Math.min(1, 1 - Math.abs(tod - 0.5) * 3));
    sunLightRef.position.copy(sky.sun.position);
    sunLightRef.target.position.set(camera.position.x, 0, camera.position.z);
    sunLightRef.target.updateMatrixWorld();
    sunLightRef.color.copy(sunCol);
    sunLightRef.intensity = 0.18 + dayness * 1.5;
    hemiLightRef.intensity = 0.3 + dayness * 0.85;

    sky.starMat.opacity = (1 - dayness) * 0.9;
    sky.stars.rotation.y += 0.0001;
    sky.sun.material.color.setHex(tod < 0.25 || tod > 0.75 ? 0xdde8ff : 0xffe8a0);

    if (Math.abs(angle - lastSunAngle) > 0.035) {
      sunLightRef.shadow.needsUpdate = true;
      lastSunAngle = angle;
    }
  }

  function update(dt, elapsed, camera) {
    const px = camera.position.x, pz = camera.position.z;
    chunks.update(px, pz);

    for (const c of clouds.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 150) c.position.x = -150;
    }

    pond.foamMat.opacity = 0.25 + Math.sin(elapsed * 1.2) * 0.08;
  }

  return {
    update,
    updateTimeOfDay,
    getInteractables: () => interactables,
    buildCollision,
    chunks, house, stable, shed, sky, clouds, pond,
  };
}
