// ═══════════════════════════════════════════════════════════════
//  terrain.js — ONE source of truth for terrain height
//  Replaces: engine.js terrainState, world.js infiniteTerrainHeight,
//            script.js terrainHeight, game.js terrainHeightFn
// ═══════════════════════════════════════════════════════════════

// ── Seeded value noise (deterministic across reloads) ─────────
const SEED = 20250101;
function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7 + SEED) * 43758.5453;
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

// ── The single terrain height function ───────────────────────
// Returns world Y at (x, z). Used by EVERYTHING.
export function terrainHeight(x, z) {
  // River: a soft channel that winds, with proper banks (no trench)
  const riverCenter = Math.sin(x * 0.008) * 30 - 100;
  const distFromRiver = Math.abs(z - riverCenter);
  const riverWidth = 8;
  const riverDepth = -2.5;
  // Smooth bank falloff (cosine, not linear) — no hard trench edges
  const riverT = Math.max(0, 1 - distFromRiver / riverWidth);
  const river = riverDepth * smoothstep(riverT);

  // Rolling hills
  const hills = (fbm2(x * 0.012 + 100, z * 0.012 + 100, 4) - 0.5) * 10;

  // Distant mountains (only far from spawn)
  const mountainNoise = fbm2(x * 0.004 + 200, z * 0.004 + 200, 3);
  const mountainMask = Math.max(0, mountainNoise - 0.62);
  const mountains = mountainMask * mountainMask * 60;

  // Fine bumps for texture
  const bumps = (fbm2(x * 0.09, z * 0.09, 2) - 0.5) * 1.2;

  // Flatten a generous area around spawn (radius 70, smooth edge)
  const distFromSpawn = Math.sqrt(x * x + z * z);
  const flatRadius = 70;
  const flatEdge = 25;
  const flatMask = 1 - smoothstep(Math.max(0, distFromSpawn - flatRadius) / flatEdge);

  const raw = hills + mountains + bumps + river;
  return raw * (1 - flatMask * 0.95) + flatMask * 0.0;
}

// ── Expose for legacy code that called setTerrainHeightFn ────
// (kept for compatibility — engine.js will import terrainHeight
//  directly, but horse.js/plants.js may still call setTerrainHeightFn)
let _current = terrainHeight;
export function setTerrainHeightFn(fn) { _current = fn; }
export function getTerrainHeight(x, z) { return _current(x, z); }

// ── Water level (for pond/river rendering) ───────────────────
export const WATER_LEVEL = -1.8;

// ── Chunk geometry helpers (shared by world.js) ──────────────
export const CHUNK_SIZE = 40;
export const CHUNK_SEGMENTS = 32;
export const CHUNK_VIEW = 3;

// Compute a normal from the height field (for smooth shading at seams)
export function terrainNormal(x, z, eps = 0.5) {
  const hL = terrainHeight(x - eps, z);
  const hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps);
  const hU = terrainHeight(x, z + eps);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * eps;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}
