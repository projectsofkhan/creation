// Verdant Vale — entry point
// Synchronous imports, no top-level await, no dynamic import chain.

import { initGame } from './creation/game.js';

const barFill = document.getElementById('barFill');
const status = document.getElementById('loadStatus');

function progress(pct, label) {
  if (barFill) barFill.style.width = pct + '%';
  if (status && label) status.textContent = label;
}

// Surface real errors to the loader
window.addEventListener('error', e => {
  if (status) status.textContent = 'error: ' + (e.message || 'unknown').slice(0, 60);
});
window.addEventListener('unhandledrejection', e => {
  if (status) status.textContent = 'module error: ' + (e.reason?.message || 'unknown').slice(0, 60);
});

// Boot
progress(10, 'loading three.js');

try {
  await initGame({ progress });
} catch (err) {
  console.error('[Verdant Vale] boot failed:', err);
  if (status) status.textContent = 'failed — see console';
  progress(100, 'failed');
}