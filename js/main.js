import { startLoop } from './engine/game-loop.js';
import { initRenderer, clear, getCtx, getWidth, getHeight } from './engine/renderer.js';
import { initInput, left, right, up, down, jump, interact, clearJustPressed } from './engine/input.js';
import { applyGravity, resolvePlatforms, clampToWorld } from './engine/physics.js';
import { Camera } from './engine/camera.js';
import { Tiger } from './entities/tiger.js';
import { BathroomScene } from './scenes/bathroom.js';
import { GardenScene } from './scenes/garden.js';
import { Overlays } from './ui/overlays.js';
import { HUD } from './ui/hud.js';
import { PolaroidPopup } from './ui/polaroid.js';
import { loadFlushPool, getRandomFlush } from './systems/flush-pool.js';
import { loadState, getState, updateState } from './systems/state.js';
import {
  setScene, getScene, startTransition, updateTransition,
  getTransitionAlpha, isTransitioning
} from './scenes/scene-manager.js';

let tiger;
let camera;
let bathroom;
let garden;
let overlays;
let hud;
let polaroid;
let ready = false;
let climbing = false;
let toiletFlushed = false;
let stateRestored = false;
let skillsData = null;
let saveTimer = 0;
let diveHintEl = null;

function init() {
  initRenderer();
  initInput();
  loadState();
  loadFlushPool();
  loadSkillsData();
  startLoop(update, render);
}

async function loadSkillsData() {
  try {
    skillsData = await fetch('data/skills.json').then(r => r.json());
  } catch (e) {
    console.warn('Failed to load skills data:', e);
  }
}

function setup() {
  camera = new Camera(getWidth(), getHeight());
  window.addEventListener('resize', () => camera.resize(getWidth(), getHeight()));

  bathroom = new BathroomScene();
  garden = new GardenScene();
  tiger = new Tiger(0, 0);
  overlays = new Overlays();
  hud = new HUD();
  polaroid = new PolaroidPopup(document.getElementById('ui-layer'));

  const saved = getState();
  hud.tokens = saved.tokens || 0;
  hud.multiplier = saved.multiplier || 1.0;

  setScene(bathroom, tiger);

  camera.x = tiger.x - camera.viewW / 2;
  camera.y = tiger.y - camera.viewH / 2;

  ready = true;

  if (!saved.hasVisited) {
    overlays.openEntry((name) => {
      updateState({ visitorName: name, hasVisited: true });
    });
  }
}

function update(dt) {
  if (!ready) {
    if (getWidth() > 0) setup();
    return;
  }

  if (!stateRestored && garden.dataLoaded) {
    const saved = getState();
    garden.restoreState(saved.plantStages, saved.fedNutrients);
    stateRestored = true;
  }

  if (overlays.isOpen()) {
    if (!overlays.entryMode && interact()) overlays.close();
    clearJustPressed();
    return;
  }

  if (updateTransition(dt)) {
    clearJustPressed();
    const scene = getScene();
    camera.clamp(0, 0, scene.worldW, scene.worldH);
    return;
  }

  const scene = getScene();
  const doJump = jump();
  const doInteract = interact();

  // Pipe climbing
  if (scene === garden && garden.pipe.isOnPipe(tiger)) {
    if (up()) {
      climbing = true;
      tiger.vy = -200;
      tiger.vx = 0;
      tiger.grounded = false;

      if (tiger.y <= garden.pipe.y) {
        climbing = false;
        startTransition(garden, bathroom, tiger);
        clearJustPressed();
        return;
      }
    } else if (down()) {
      climbing = true;
      tiger.vy = 150;
      tiger.vx = 0;
    } else if (climbing) {
      tiger.vy = 0;
    }

    if (climbing && !up() && !down()) {
      tiger.vy = 0;
    }

    if (climbing) {
      tiger.x += tiger.vx * dt;
      tiger.y += tiger.vy * dt;
      tiger.update(dt);
      scene.update(tiger);
      camera.follow(tiger);
      camera.clamp(0, 0, scene.worldW, scene.worldH);
      clearJustPressed();
      return;
    }
  } else {
    climbing = false;
  }

  // Normal movement
  tiger.applyInput(left(), right(), doJump);
  applyGravity(tiger, dt);
  resolvePlatforms(tiger, scene.platforms);
  clampToWorld(tiger, 0, scene.worldW);
  tiger.update(dt);

  scene.update(tiger);
  hud.update(dt);

  // Interactions
  if (doInteract && scene === bathroom) {
    const obj = bathroom.getInteractableAt(tiger);
    if (obj) handleBathroomInteract(obj);
  }

  if (doInteract && scene === garden) {
    const result = garden.handleInteract(tiger);
    if (result) handleGardenResult(result);
  }

  // Periodic state save
  saveTimer++;
  if (saveTimer >= 300) {
    updateState({ tokens: hud.tokens, multiplier: hud.multiplier });
    saveTimer = 0;
  }

  camera.follow(tiger);
  camera.clamp(0, 0, scene.worldW, scene.worldH);

  clearJustPressed();
}

function handleBathroomInteract(obj) {
  switch (obj.type) {
    case 'toilet':
      if (toiletFlushed) {
        toiletFlushed = false;
        removeDiveHint();
        startTransition(bathroom, garden, tiger);
      } else {
        const item = getRandomFlush();
        polaroid.showFlush(item);
        toiletFlushed = true;
        const s = getState();
        updateState({ flushCount: (s.flushCount || 0) + 1 });
        hud.addMultiplier(0.1);
        showDiveHint();
        setTimeout(() => {
          toiletFlushed = false;
          removeDiveHint();
        }, 3000);
      }
      break;
    case 'mirror':
      overlays.openSkills();
      break;
    case 'picture':
      overlays.openAbout();
      break;
    case 'note':
      overlays.openContact();
      break;
    case 'door':
      window.location.href = 'classic.html';
      break;
  }
}

function showDiveHint() {
  removeDiveHint();
  diveHintEl = document.createElement('div');
  diveHintEl.className = 'flush-dive-hint';
  diveHintEl.textContent = '[E] dive deeper?';
  document.getElementById('ui-layer').appendChild(diveHintEl);
}

function removeDiveHint() {
  if (diveHintEl) {
    diveHintEl.remove();
    diveHintEl = null;
  }
}

function handleGardenResult(result) {
  if (result.action === 'pickup') {
    hud.addTokens(500);
  }
  if (result.action === 'fed') {
    hud.addTokens(2000);
    hud.addMultiplier(0.1);

    const s = getState();
    const fed = [...(s.fedNutrients || [])];
    if (!fed.includes(result.nutrientId)) fed.push(result.nutrientId);
    const stages = { ...(s.plantStages || {}) };
    stages[result.plant.skillKey] = result.plant.stage;
    updateState({ fedNutrients: fed, plantStages: stages });

    if (result.plant.isFullyGrown && skillsData) {
      const skill = skillsData[result.plant.skillKey];
      if (skill && skill.plant) {
        polaroid.showBloom(skill.plant.name, skill.plant.bloomStory);
        hud.addMultiplier(0.5);
      }
    }
  }
}

function render() {
  if (!ready) return;

  const ctx = getCtx();
  const scene = getScene();

  clear('#f5f0eb');

  ctx.save();
  camera.apply(ctx);

  scene.render(ctx);
  tiger.render(ctx);

  ctx.restore();

  const alpha = getTransitionAlpha();
  if (alpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, getWidth(), getHeight());
  }

  hud.render(ctx);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
