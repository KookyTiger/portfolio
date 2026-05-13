let activeScene = null;
let transition = null;

export function setScene(scene, tiger) {
  if (activeScene && activeScene.exit) activeScene.exit();
  activeScene = scene;
  if (activeScene.enter) activeScene.enter(tiger);
}

export function getScene() { return activeScene; }

export function startTransition(fromScene, toScene, tiger, duration = 1.2) {
  transition = {
    from: fromScene,
    to: toScene,
    tiger,
    duration,
    elapsed: 0,
    phase: 'out',
  };
}

export function updateTransition(dt) {
  if (!transition) return false;

  transition.elapsed += dt;
  const half = transition.duration / 2;

  if (transition.phase === 'out' && transition.elapsed >= half) {
    transition.phase = 'in';
    transition.elapsed = 0;
    if (activeScene && activeScene.exit) activeScene.exit();
    activeScene = transition.to;
    if (activeScene.enter) activeScene.enter(transition.tiger);
  }

  if (transition.phase === 'in' && transition.elapsed >= half) {
    transition = null;
    return false;
  }

  return true;
}

export function getTransitionAlpha() {
  if (!transition) return 0;
  const half = transition.duration / 2;
  if (transition.phase === 'out') {
    return transition.elapsed / half;
  }
  return 1 - transition.elapsed / half;
}

export function isTransitioning() { return transition !== null; }
